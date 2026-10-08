/**
 * Copies the pinned data version's manifest, summaries and municipality list into .data/
 * before `next build`, after checking each one, so a wrong or tampered file fails the build.
 */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DATA_VERSION, VERSION_URL } from '../src/data-version'
import type { Municipality } from '../src/lib/data'
import type { Summary } from '../src/lib/results'
import { YEAR } from '../src/lib/elections'
import {
  parseManifest,
  summaryPaths,
  verifyFile,
  verifyManifest,
  type Manifest,
} from '../src/lib/manifest'
import {
  assetFiles,
  cacheParquetExtension,
  duckdbPackageVersion,
  EXTENSION_PATH,
  packageFile,
  sha256Of,
} from './duckdb-assets'
import { nodeRunner } from './duckdb-node'
import { buildSearchIndex } from './search-index'

export type DataMode = 'published' | 'fixtures'

export interface DataSource {
  mode: DataMode
  read(relativePath: string): Promise<Uint8Array | null>
}

const WEB_ROOT = path.resolve(import.meta.dirname, '..')
export const DATA_DIR = path.join(WEB_ROOT, '.data')
const PUBLIC_DIR = path.join(WEB_ROOT, 'public')
const MUNICIPALITIES = `${YEAR}/municipios.parquet`

export function fixtureSource(root = path.join(WEB_ROOT, 'fixtures')): DataSource {
  return {
    mode: 'fixtures',
    async read(relativePath) {
      try {
        return new Uint8Array(await readFile(path.join(root, relativePath)))
      } catch {
        return null
      }
    },
  }
}

export function publishedSource(baseUrl = VERSION_URL): DataSource {
  return {
    mode: 'published',
    async read(relativePath) {
      const response = await fetch(`${baseUrl}/${relativePath}`, {
        signal: AbortSignal.timeout(60_000),
      })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`${relativePath}: HTTP ${response.status}`)
      return new Uint8Array(await response.arrayBuffer())
    },
  }
}

export interface LoadedVersion {
  manifest: Manifest
  manifestBytes: Uint8Array
  summaries: Map<string, Uint8Array>
  municipalities: Uint8Array
}

/** Reads the manifest, and checks a published one against its pinned SHA-256. */
export async function readManifest(
  source: DataSource,
  expectedSha256: string = DATA_VERSION.manifestSha256,
): Promise<{ manifest: Manifest; manifestBytes: Uint8Array }> {
  const manifestBytes = await source.read('manifest.json')
  const manifest =
    source.mode === 'published'
      ? verifyManifest(manifestBytes, expectedSha256)
      : parseManifest(manifestBytes ?? new Uint8Array())
  return { manifest, manifestBytes: manifestBytes as Uint8Array }
}

/** Reads the municipality list, and checks it against the manifest. */
export async function readMunicipalities(
  source: DataSource,
  manifest: Manifest,
): Promise<Uint8Array> {
  const municipalities = await source.read(MUNICIPALITIES)
  verifyFile(manifest, MUNICIPALITIES, municipalities)
  return municipalities as Uint8Array
}

/** Reads and checks the manifest, every summary and the municipality list. Writes nothing. */
export async function loadVersion(
  source: DataSource,
  expectedSha256: string = DATA_VERSION.manifestSha256,
): Promise<LoadedVersion> {
  const { manifest, manifestBytes } = await readManifest(source, expectedSha256)
  const summaries = new Map<string, Uint8Array>()
  for (const summaryPath of summaryPaths(manifest)) {
    const bytes = await source.read(summaryPath)
    verifyFile(manifest, summaryPath, bytes)
    summaries.set(path.basename(summaryPath, '.json'), bytes as Uint8Array)
  }
  const municipalities = await readMunicipalities(source, manifest)
  return { manifest, manifestBytes, summaries, municipalities }
}

async function publishedAsset(assetBase: string, assetPath: string): Promise<Uint8Array> {
  const response = await fetch(`${assetBase}/${assetPath}`, {
    signal: AbortSignal.timeout(120_000),
  })
  if (response.status === 404) {
    throw new Error(`${assetBase}/${assetPath} is not published. Run the duckdb-wasm target first.`)
  }
  if (!response.ok) throw new Error(`${assetPath}: HTTP ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

/**
 * Caches the Worker's copy of the pinned Parquet extension, so the build's own queries never
 * contact extensions.duckdb.org.
 */
export async function cachePublishedExtension(assetBase: string, cacheDir?: string): Promise<void> {
  await cacheParquetExtension(
    await publishedAsset(assetBase, EXTENSION_PATH),
    `${assetBase}/${EXTENSION_PATH}`,
    cacheDir,
  )
}

/** Checks that the Worker serves the lockfile's module and the pinned extension. */
export async function verifyPublishedAssets(assetBase: string, cacheDir?: string): Promise<void> {
  const wasmModule = await publishedAsset(assetBase, 'duckdb-eh.wasm')
  if (sha256Of(wasmModule) !== sha256Of(await readFile(packageFile('duckdb-eh.wasm')))) {
    throw new Error('the published duckdb-eh.wasm differs from the one in the locked package')
  }
  await cachePublishedExtension(assetBase, cacheDir)
}

/**
 * Writes the search index into the static export under a path named for its content, so the
 * browser can cache it for good. Returns that path.
 */
async function writeSearchIndex(
  summaries: Map<string, Uint8Array>,
  municipalities: Record<string, Municipality[]>,
): Promise<string> {
  const parsed = new Map<string, Summary>()
  for (const [area, bytes] of summaries) {
    parsed.set(area, JSON.parse(new TextDecoder().decode(bytes)) as Summary)
  }
  const index = buildSearchIndex(parsed, municipalities)
  const municipios = JSON.stringify(index.municipios)
  const candidatos = JSON.stringify(index.candidatos)
  const hash = sha256Of(new TextEncoder().encode(`${municipios}\n${candidatos}`)).slice(0, 16)
  const target = path.join(PUBLIC_DIR, 'busca', hash)
  await rm(path.join(PUBLIC_DIR, 'busca'), { recursive: true, force: true })
  await mkdir(target, { recursive: true })
  await writeFile(path.join(target, 'municipios.json'), municipios)
  await writeFile(path.join(target, 'candidatos.json'), candidatos)
  return `/busca/${hash}`
}

/** The municipality list for the state pages, one entry per area, read with DuckDB. */
async function municipalityList(file: string): Promise<Record<string, Municipality[]>> {
  const run = await nodeRunner()
  const rows = await run(
    'SELECT lower(uf) AS area, municipio, nome, capital FROM read_parquet(?) ORDER BY uf, nome',
    [file],
  )
  const byArea: Record<string, Municipality[]> = {}
  for (const row of rows) {
    const area = String(row.area)
    ;(byArea[area] ??= []).push({
      municipio: Number(row.municipio),
      nome: String(row.nome),
      capital: Boolean(row.capital),
    })
  }
  return byArea
}

export function dataMode(env: Record<string, string | undefined>): DataMode {
  const mode: DataMode = env.ELEICOES_DATA === 'fixtures' ? 'fixtures' : 'published'
  // Fixture numbers come from a handful of stations. On Vercel they would go live as results.
  if (mode === 'fixtures' && env.VERCEL) {
    throw new Error('ELEICOES_DATA=fixtures is set on Vercel, which deploys only published data')
  }
  return mode
}

async function main(): Promise<void> {
  const mode = dataMode(process.env)
  const source = mode === 'fixtures' ? fixtureSource() : publishedSource()
  const { manifest, manifestBytes, summaries, municipalities } = await loadVersion(source)
  const duckdbVersion = duckdbPackageVersion()
  // Fixtures have no Worker, so a fixtures build serves their files and the DuckDB assets
  // itself, from the same origin, under the same layout.
  const dataBase = mode === 'fixtures' ? '/_fixtures/data' : VERSION_URL
  const assetBase =
    mode === 'fixtures'
      ? `/_fixtures/assets/duckdb-wasm/${duckdbVersion}`
      : `${DATA_VERSION.workerUrl}/assets/duckdb-wasm/${duckdbVersion}`
  if (mode === 'published') await verifyPublishedAssets(assetBase)

  await rm(DATA_DIR, { recursive: true, force: true })
  await mkdir(path.join(DATA_DIR, 'resumo'), { recursive: true })
  await writeFile(path.join(DATA_DIR, 'manifest.json'), manifestBytes)
  for (const [area, bytes] of summaries) {
    await writeFile(path.join(DATA_DIR, 'resumo', `${area}.json`), bytes)
  }
  const municipalitiesFile = path.join(DATA_DIR, 'municipios.parquet')
  await writeFile(municipalitiesFile, municipalities)
  const municipalityLists = await municipalityList(municipalitiesFile)
  await writeFile(path.join(DATA_DIR, 'municipios.json'), JSON.stringify(municipalityLists))
  const searchBase = await writeSearchIndex(summaries, municipalityLists)

  // A browser Worker must load from the page's own origin, so the app serves this script.
  const workerScript = `/duckdb/${duckdbVersion}/duckdb-browser-eh.worker.js`
  await rm(path.join(PUBLIC_DIR, 'duckdb'), { recursive: true, force: true })
  await mkdir(path.dirname(path.join(PUBLIC_DIR, workerScript)), { recursive: true })
  await cp(packageFile('duckdb-browser-eh.worker.js'), path.join(PUBLIC_DIR, workerScript))

  const fixturesDir = path.join(PUBLIC_DIR, '_fixtures')
  await rm(fixturesDir, { recursive: true, force: true })
  if (mode === 'fixtures') {
    for (const entry of manifest.arquivos) {
      await mkdir(path.dirname(path.join(fixturesDir, 'data', entry.path)), { recursive: true })
      await cp(
        path.join(WEB_ROOT, 'fixtures', entry.path),
        path.join(fixturesDir, 'data', entry.path),
      )
    }
    for (const asset of await assetFiles()) {
      const target = path.join(PUBLIC_DIR, assetBase, asset.path)
      await mkdir(path.dirname(target), { recursive: true })
      await cp(asset.source, target)
    }
  }

  const version = mode === 'published' ? DATA_VERSION.name : null
  await writeFile(
    path.join(DATA_DIR, 'source.json'),
    JSON.stringify({ mode, version, dataBase, assetBase, workerScript, searchBase }),
  )
  console.log(`data: ${mode} ${version ?? ''}, ${summaries.size} summaries checked`)
  // The DuckDB runner keeps a Node worker alive.
  process.exit(0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main().catch((error: unknown) => {
    console.error(`prepare-data failed: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  })
}
