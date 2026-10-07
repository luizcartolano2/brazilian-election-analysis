/**
 * Copies the pinned data version's manifest, summaries and municipality list into .data/
 * before `next build`, after checking each one, so a wrong or tampered file fails the build.
 */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DATA_VERSION, VERSION_URL } from '../src/data-version'
import { YEAR } from '../src/lib/elections'
import {
  parseManifest,
  summaryPaths,
  verifyFile,
  verifyManifest,
  type Manifest,
} from '../src/lib/manifest'
import { assetFiles, duckdbPackageVersion, packageFile, sha256Of } from './duckdb-assets'
import { nodeRunner } from './duckdb-node'

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

/** Reads and checks the manifest, every summary and the municipality list. Writes nothing. */
export async function loadVersion(
  source: DataSource,
  expectedSha256: string = DATA_VERSION.manifestSha256,
): Promise<LoadedVersion> {
  const manifestBytes = await source.read('manifest.json')
  const manifest =
    source.mode === 'published'
      ? verifyManifest(manifestBytes, expectedSha256)
      : parseManifest(manifestBytes ?? new Uint8Array())
  const summaries = new Map<string, Uint8Array>()
  for (const summaryPath of summaryPaths(manifest)) {
    const bytes = await source.read(summaryPath)
    verifyFile(manifest, summaryPath, bytes)
    summaries.set(path.basename(summaryPath, '.json'), bytes as Uint8Array)
  }
  const municipalities = await source.read(MUNICIPALITIES)
  verifyFile(manifest, MUNICIPALITIES, municipalities)
  return {
    manifest,
    manifestBytes: manifestBytes as Uint8Array,
    summaries,
    municipalities: municipalities as Uint8Array,
  }
}

/** Checks that the Worker serves the DuckDB assets this lockfile and pin expect. */
async function verifyPublishedAssets(assetBase: string): Promise<void> {
  for (const asset of await assetFiles()) {
    const response = await fetch(`${assetBase}/${asset.path}`, {
      signal: AbortSignal.timeout(120_000),
    })
    if (response.status === 404) {
      throw new Error(
        `${assetBase}/${asset.path} is not published. Run the duckdb-wasm target first.`,
      )
    }
    if (!response.ok) throw new Error(`${asset.path}: HTTP ${response.status}`)
    const published = sha256Of(new Uint8Array(await response.arrayBuffer()))
    if (published !== sha256Of(await readFile(asset.source))) {
      throw new Error(`the published ${asset.path} differs from the one this build expects`)
    }
  }
}

/** The municipality list for the state pages, one entry per area, read with DuckDB. */
async function municipalityList(file: string): Promise<Record<string, unknown[]>> {
  const run = await nodeRunner()
  const rows = await run(
    'SELECT lower(uf) AS area, municipio, nome, capital FROM read_parquet(?) ORDER BY uf, nome',
    [file],
  )
  const byArea: Record<string, unknown[]> = {}
  for (const row of rows) {
    const area = String(row.area)
    ;(byArea[area] ??= []).push({ municipio: row.municipio, nome: row.nome, capital: row.capital })
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

  await rm(DATA_DIR, { recursive: true, force: true })
  await mkdir(path.join(DATA_DIR, 'resumo'), { recursive: true })
  await writeFile(path.join(DATA_DIR, 'manifest.json'), manifestBytes)
  for (const [area, bytes] of summaries) {
    await writeFile(path.join(DATA_DIR, 'resumo', `${area}.json`), bytes)
  }
  const municipalitiesFile = path.join(DATA_DIR, 'municipios.parquet')
  await writeFile(municipalitiesFile, municipalities)
  await writeFile(
    path.join(DATA_DIR, 'municipios.json'),
    JSON.stringify(await municipalityList(municipalitiesFile)),
  )

  // A browser Worker must load from the page's own origin, so the app serves this script.
  const workerScript = `/duckdb/${duckdbVersion}/duckdb-browser-eh.worker.js`
  await rm(path.join(PUBLIC_DIR, 'duckdb'), { recursive: true, force: true })
  await mkdir(path.dirname(path.join(PUBLIC_DIR, workerScript)), { recursive: true })
  await cp(packageFile('duckdb-browser-eh.worker.js'), path.join(PUBLIC_DIR, workerScript))

  // Fixtures have no Worker, so a fixtures build serves their files and the DuckDB assets
  // itself, from the same origin, under the same layout.
  const fixturesDir = path.join(PUBLIC_DIR, '_fixtures')
  await rm(fixturesDir, { recursive: true, force: true })
  let dataBase: string
  let assetBase: string
  if (mode === 'fixtures') {
    dataBase = '/_fixtures/data'
    assetBase = `/_fixtures/assets/duckdb-wasm/${duckdbVersion}`
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
  } else {
    dataBase = VERSION_URL
    assetBase = `${DATA_VERSION.workerUrl}/assets/duckdb-wasm/${duckdbVersion}`
    await verifyPublishedAssets(assetBase)
  }

  const version = mode === 'published' ? DATA_VERSION.name : null
  await writeFile(
    path.join(DATA_DIR, 'source.json'),
    JSON.stringify({ mode, version, dataBase, assetBase, workerScript }),
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
