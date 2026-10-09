/**
 * Copies each pinned data version's manifest, summaries and municipality list into
 * .data/rounds/<round>/ before `next build`, after checking each one, so a wrong or tampered
 * file fails the build.
 */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DATA_VERSIONS, versionUrl, WORKER_URL, type PinnedVersion } from '../src/data-version'
import type { Municipality } from '../src/lib/data'
import type { Run } from '../src/lib/drilldown/queries'
import type { Summary } from '../src/lib/results'
import { ROUNDS, YEAR, type Round } from '../src/lib/elections'
import { runoffMismatches } from '../src/lib/rounds'
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
import { GEO_BUILD } from './geo-assets'
import { buildMaps, readBoundaries } from './map-data'
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

export function publishedSource(baseUrl: string): DataSource {
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

/** One round that a build reads, and where the browser reads it from. */
export interface PlannedRound {
  round: Round
  source: DataSource
  pin: PinnedVersion | null
  dataBase: string
}

const FIXTURE_DIRS: Record<Round, string> = { 1: 'fixtures', 2: 'fixtures-t2' }

/**
 * A fixtures build has no Worker, so it serves each round's files itself, from the same origin,
 * under the same layout as a version.
 */
const FIXTURE_DATA: Record<Round, string> = { 1: '/_fixtures/data', 2: '/_fixtures/data-t2' }

/** Every pinned round, or both rounds of the fixtures. */
export function plannedRounds(
  mode: DataMode,
  versions: { 1: PinnedVersion; 2: PinnedVersion | null } = DATA_VERSIONS,
  fixturesRoot = WEB_ROOT,
): PlannedRound[] {
  return ROUNDS.flatMap((round): PlannedRound[] => {
    if (mode === 'fixtures') {
      const source = fixtureSource(path.join(fixturesRoot, FIXTURE_DIRS[round]))
      return [{ round, source, pin: null, dataBase: FIXTURE_DATA[round] }]
    }
    const pin = versions[round]
    if (pin === null) return []
    return [{ round, source: publishedSource(versionUrl(pin)), pin, dataBase: versionUrl(pin) }]
  })
}

/** Reads the manifest, checks its round, and checks a published one against its pinned SHA-256. */
export async function readManifest(
  source: DataSource,
  round: Round,
  expectedSha256: string,
): Promise<{ manifest: Manifest; manifestBytes: Uint8Array }> {
  const manifestBytes = await source.read('manifest.json')
  const manifest =
    source.mode === 'published'
      ? verifyManifest(manifestBytes, expectedSha256, round)
      : parseManifest(manifestBytes ?? new Uint8Array(), round)
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

/**
 * Reads and checks the manifest, every summary and the municipality list. Writes nothing.
 * `expectedSha256` is the pin, which a fixtures source does not need.
 */
export async function loadVersion(
  source: DataSource,
  round: Round,
  expectedSha256 = '',
): Promise<LoadedVersion> {
  const { manifest, manifestBytes } = await readManifest(source, round, expectedSha256)
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
  summaries: Map<string, Summary>,
  municipalities: Record<string, Municipality[]>,
): Promise<string> {
  const index = buildSearchIndex(summaries, municipalities)
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
async function municipalityList(run: Run, file: string): Promise<Record<string, Municipality[]>> {
  const rows = await run(
    'SELECT lower(uf) AS area, municipio, ibge, nome, capital FROM read_parquet(?) ORDER BY uf, nome',
    [file],
  )
  const byArea: Record<string, Municipality[]> = {}
  for (const row of rows) {
    const area = String(row.area)
    ;(byArea[area] ??= []).push({
      municipio: Number(row.municipio),
      ibge: row.ibge === null ? null : Number(row.ibge),
      nome: String(row.nome),
      capital: Boolean(row.capital),
    })
  }
  return byArea
}

const FIXTURES_GEO = path.join(WEB_ROOT, 'fixtures-geo')

/** The fixture boundaries' own SHA256SUMS, which pin them as the published list pins those. */
async function fixtureGeoPins(): Promise<Record<string, string>> {
  const sums = await readFile(path.join(FIXTURES_GEO, 'SHA256SUMS'), 'utf-8')
  const pins: Record<string, string> = {}
  for (const line of sums.trim().split('\n')) {
    const [sha256, name] = line.split('  ')
    if (sha256 !== undefined && name !== undefined && name !== 'manifest.json') pins[name] = sha256
  }
  return pins
}

async function publishedBoundary(geoBase: string, name: string): Promise<Uint8Array | null> {
  const response = await fetch(`${geoBase}/${name}`, { signal: AbortSignal.timeout(120_000) })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

export function dataMode(env: Record<string, string | undefined>): DataMode {
  const mode: DataMode = env.ELEICOES_DATA === 'fixtures' ? 'fixtures' : 'published'
  // Fixture numbers come from a handful of stations. On Vercel they would go live as results.
  if (mode === 'fixtures' && env.VERCEL) {
    throw new Error('ELEICOES_DATA=fixtures is set on Vercel, which deploys only published data')
  }
  return mode
}

function parseSummaries(summaries: Map<string, Uint8Array>): Map<string, Summary> {
  return new Map(
    [...summaries].map(([area, bytes]) => [
      area,
      JSON.parse(new TextDecoder().decode(bytes)) as Summary,
    ]),
  )
}

async function main(): Promise<void> {
  const mode = dataMode(process.env)
  const rounds: (PlannedRound & LoadedVersion & { parsed: Map<string, Summary> })[] = []
  for (const planned of plannedRounds(mode)) {
    const loaded = await loadVersion(planned.source, planned.round, planned.pin?.manifestSha256)
    rounds.push({ ...planned, ...loaded, parsed: parseSummaries(loaded.summaries) })
  }
  const [first, second] = rounds
  if (first?.round !== 1) throw new Error('the build has no data version for round 1')
  if (second !== undefined) {
    const problems = runoffMismatches(first.parsed, second.parsed)
    if (problems.length > 0) {
      throw new Error(`the two rounds' versions disagree:\n${problems.join('\n')}`)
    }
  }

  const duckdbVersion = duckdbPackageVersion()
  const assetBase =
    mode === 'fixtures'
      ? `/_fixtures/assets/duckdb-wasm/${duckdbVersion}`
      : `${WORKER_URL}/assets/duckdb-wasm/${duckdbVersion}`
  if (mode === 'published') await verifyPublishedAssets(assetBase)

  // A fixtures build serves its boundaries itself, as it serves its data.
  const geoBase = mode === 'fixtures' ? '/_fixtures/geo' : `${WORKER_URL}/${GEO_BUILD.path}`
  const geoSha256 = mode === 'fixtures' ? await fixtureGeoPins() : GEO_BUILD.sha256
  const boundaries = await readBoundaries(
    mode === 'fixtures'
      ? (name) =>
          readFile(path.join(FIXTURES_GEO, name)).then(
            (bytes) => new Uint8Array(bytes),
            () => null,
          )
      : (name) => publishedBoundary(geoBase, name),
    geoSha256,
  )

  await rm(DATA_DIR, { recursive: true, force: true })
  const run = await nodeRunner()
  let searchBase = ''
  for (const round of rounds) {
    const roundDir = path.join(DATA_DIR, 'rounds', String(round.round))
    await mkdir(path.join(roundDir, 'resumo'), { recursive: true })
    await writeFile(path.join(roundDir, 'manifest.json'), round.manifestBytes)
    for (const [area, bytes] of round.summaries) {
      await writeFile(path.join(roundDir, 'resumo', `${area}.json`), bytes)
    }
    const municipalitiesFile = path.join(roundDir, 'municipios.parquet')
    await writeFile(municipalitiesFile, round.municipalities)
    const municipalityLists = await municipalityList(run, municipalitiesFile)
    await writeFile(path.join(roundDir, 'municipios.json'), JSON.stringify(municipalityLists))
    // Search leads to round-1 pages, and candidate pages carry both rounds.
    if (round.round === 1) searchBase = await writeSearchIndex(round.parsed, municipalityLists)
    await buildMaps({
      round: round.round,
      colorSummaries: round.round === 2 ? first.parsed : undefined,
      run,
      source: round.source,
      manifest: round.manifest,
      summaries: round.parsed,
      municipalities: municipalityLists,
      boundaries,
      out: path.join(roundDir, 'mapas'),
    })
    await writeFile(
      path.join(roundDir, 'source.json'),
      JSON.stringify({
        version: round.pin?.name ?? null,
        dataBase: round.dataBase,
        synthetic: round.manifest.sintetico === true,
      }),
    )
  }

  // A browser Worker must load from the page's own origin, so the app serves this script.
  const workerScript = `/duckdb/${duckdbVersion}/duckdb-browser-eh.worker.js`
  await rm(path.join(PUBLIC_DIR, 'duckdb'), { recursive: true, force: true })
  await mkdir(path.dirname(path.join(PUBLIC_DIR, workerScript)), { recursive: true })
  await cp(packageFile('duckdb-browser-eh.worker.js'), path.join(PUBLIC_DIR, workerScript))

  const fixturesDir = path.join(PUBLIC_DIR, '_fixtures')
  await rm(fixturesDir, { recursive: true, force: true })
  if (mode === 'fixtures') {
    for (const round of rounds) {
      for (const entry of round.manifest.arquivos) {
        const target = path.join(PUBLIC_DIR, round.dataBase, entry.path)
        await mkdir(path.dirname(target), { recursive: true })
        await cp(path.join(WEB_ROOT, FIXTURE_DIRS[round.round], entry.path), target)
      }
    }
    for (const asset of await assetFiles()) {
      const target = path.join(PUBLIC_DIR, assetBase, asset.path)
      await mkdir(path.dirname(target), { recursive: true })
      await cp(asset.source, target)
    }
    await cp(FIXTURES_GEO, path.join(fixturesDir, 'geo'), { recursive: true })
  }

  await writeFile(
    path.join(DATA_DIR, 'source.json'),
    JSON.stringify({
      mode,
      rounds: rounds.map((round) => round.round),
      assetBase,
      workerScript,
      searchBase,
      geoBase,
      geoSha256,
    }),
  )
  for (const round of rounds) {
    const name = round.pin?.name ?? mode
    console.log(`data: round ${round.round} ${name}, ${round.summaries.size} summaries checked`)
  }
  // The DuckDB runner keeps a Node worker alive.
  process.exit(0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main().catch((error: unknown) => {
    console.error(`prepare-data failed: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  })
}
