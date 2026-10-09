/**
 * Stages IBGE's municipal boundaries for the publish workflow: projected and simplified
 * TopoJSON for Brazil and for each state, then `manifest.json`, then a SHA256SUMS list.
 */
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import mapshaper from 'mapshaper'
import { DATA_VERSIONS, versionUrl, WORKER_URL } from '../src/data-version'
import { duckdbPackageVersion, sha256Of } from '../scripts/duckdb-assets'
import { nodeRunner } from '../scripts/duckdb-node'
import {
  EXPECTED_DROPS,
  GEO_CREDIT,
  GEO_EDITION,
  GEO_SETTINGS,
  GEO_SOURCE,
  LAGOONS,
  STATE_CODES,
  type ExpectedDrop,
  type GeoSettings,
  type GeoSource,
  type OutputSettings,
} from '../scripts/geo-assets'
import {
  cachePublishedExtension,
  fixtureSource,
  publishedSource,
  readManifest,
  readMunicipalities,
  type DataSource,
} from '../scripts/prepare-data'

export interface StageInput {
  zip: Uint8Array
  /** The data version's municipalities that have an IBGE code, with their names. */
  municipalities: Map<number, string>
  /** The data version that `municipalities` comes from. */
  dataVersion: string
  commit: string
  /** Keeps only these municipalities, for the fixtures. */
  only?: Set<number>
  source?: GeoSource
  settings?: GeoSettings
  expectedDrops?: ExpectedDrop[]
  lagoons?: number[]
}

export interface DroppedPart {
  municipio: number
  nome: string
  areaKm2: number
  distanciaKm: number
}

export interface PartRow {
  PART: number
  CD_MUN: number
  NM_MUN: string
  CD_UF: string
  AREA: number
  BOUNDS: string
}

type Files = Record<string, string | Buffer>

const MAPSHAPER_VERSION = (
  createRequire(import.meta.url)('mapshaper/package.json') as { version: string }
).version

const STAGED_NAMES = new Set([
  'SHA256SUMS',
  'manifest.json',
  'br.json',
  ...Object.values(STATE_CODES).map((area) => `${area}.json`),
])

function text(value: string | Uint8Array | undefined): string {
  if (value === undefined) throw new Error('mapshaper wrote no output')
  return typeof value === 'string' ? value : new TextDecoder().decode(value)
}

function shapefile(files: Files, name: string): Files {
  const picked: Files = {}
  for (const extension of ['shp', 'shx', 'dbf', 'prj']) {
    const file = files[`${name}.${extension}`]
    if (file !== undefined) picked[`${name}.${extension}`] = file
  }
  return picked
}

function stateCodeOf(code: number): string {
  return String(code).slice(0, 2)
}

function label(code: number, names: Map<number, string>): string {
  const name = names.get(code)
  return name ? `${code} (${name})` : String(code)
}

function bounds(row: PartRow): number[] {
  return row.BOUNDS.split(',').map(Number)
}

/** The gap between two bounding boxes, in projected meters. */
function gap(first: number[], second: number[]): number {
  const [ax0 = 0, ay0 = 0, ax1 = 0, ay1 = 0] = first
  const [bx0 = 0, by0 = 0, bx1 = 0, by1 = 0] = second
  return Math.hypot(Math.max(0, bx0 - ax1, ax0 - bx1), Math.max(0, by0 - ay1, ay0 - by1))
}

/** Reads, projects and splits the source into single parts, each with its area and bounds. */
export async function explodeSource(
  zip: Uint8Array,
  source: GeoSource,
  settings: GeoSettings,
  only?: Set<number>,
): Promise<{ rows: PartRow[]; parts: Files }> {
  // Codes reach these expressions only as numbers.
  const keep = only === undefined ? '' : `-filter "[${[...only].join(',')}].indexOf(+CD_MUN) > -1"`
  const exploded = await mapshaper.applyCommands(
    `-i source.zip -target ${source.layer} ${keep} -filter-fields CD_MUN,NM_MUN,CD_UF ` +
      `-each "CD_MUN=+CD_MUN" -proj ${settings.projection} -explode ` +
      `-each "PART=this.id, AREA=this.area, BOUNDS=this.bounds.join(',')" ` +
      '-o format=json parts.json -o format=shapefile parts.shp',
    { 'source.zip': Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength) },
  )
  return {
    rows: JSON.parse(text(exploded['parts.json'])) as PartRow[],
    parts: shapefile(exploded, 'parts'),
  }
}

/** Fails when an area's state code is unknown or disagrees with its own IBGE code. */
export function checkStates(rows: PartRow[]): void {
  const wrong = rows.filter(
    (row) => STATE_CODES[row.CD_UF] === undefined || row.CD_UF !== stateCodeOf(row.CD_MUN),
  )
  if (wrong.length > 0) {
    const listed = [...new Set(wrong.map((row) => `${row.CD_MUN} (${row.NM_MUN}): ${row.CD_UF}`))]
    throw new Error(
      `these areas have a state code that their IBGE code does not match: ${listed.join(', ')}`,
    )
  }
}

/** Each part farther than the limit from its municipality's largest part. */
export function farParts(rows: PartRow[], farPartKm: number): (DroppedPart & { part: number })[] {
  const byMunicipality = new Map<number, PartRow[]>()
  for (const row of rows) {
    const parts = byMunicipality.get(row.CD_MUN) ?? []
    parts.push(row)
    byMunicipality.set(row.CD_MUN, parts)
  }
  const far: (DroppedPart & { part: number })[] = []
  for (const [municipio, parts] of byMunicipality) {
    const largest = parts.reduce((best, part) => (part.AREA > best.AREA ? part : best))
    for (const part of parts) {
      if (part === largest) continue
      const distance = gap(bounds(largest), bounds(part))
      if (distance <= farPartKm * 1000) continue
      far.push({
        part: part.PART,
        municipio,
        nome: part.NM_MUN,
        areaKm2: Math.round(part.AREA / 1000) / 1000,
        distanciaKm: Math.round(distance / 1000),
      })
    }
  }
  return far.sort((a, b) => a.municipio - b.municipio || b.areaKm2 - a.areaKm2)
}

/** Matches each far part to its own listed entry, and fails on any part or entry left over. */
export function checkDrops(
  found: DroppedPart[],
  expected: ExpectedDrop[],
  present: Set<number>,
): void {
  const used = new Set<number>()
  const problems: string[] = []
  for (const part of found) {
    const index = expected.findIndex(
      (drop, position) =>
        !used.has(position) && drop.municipio === part.municipio && drop.areaKm2 === part.areaKm2,
    )
    if (index === -1) {
      problems.push(
        `an unexpected far part of ${part.municipio} (${part.nome}): ${part.areaKm2} km², ${part.distanciaKm} km from its largest part`,
      )
    } else {
      used.add(index)
    }
  }
  expected.forEach((drop, position) => {
    if (!used.has(position) && present.has(drop.municipio)) {
      problems.push(`EXPECTED_DROPS lists ${drop.nome}, ${drop.areaKm2} km², which stayed`)
    }
  })
  if (problems.length > 0) {
    throw new Error(`${problems.join('. ')}. Review each part, then update EXPECTED_DROPS`)
  }
}

/** Fails unless each municipality has an area, and each area a municipality or a lagoon. */
export function checkJoin(
  areas: Map<number, string>,
  municipalities: Map<number, string>,
  lagoons: number[],
): void {
  const missing = [...municipalities.keys()]
    .filter((code) => !areas.has(code))
    .sort((a, b) => a - b)
  const unmatched = [...areas.keys()]
    .filter((code) => !municipalities.has(code) && !lagoons.includes(code))
    .sort((a, b) => a - b)
  const problems: string[] = []
  if (missing.length > 0) {
    const listed = missing.map((code) => label(code, municipalities)).join(', ')
    problems.push(`no boundary for the municipalities ${listed}`)
  }
  if (unmatched.length > 0) {
    const listed = unmatched.map((code) => label(code, areas)).join(', ')
    problems.push(`no municipality for the areas ${listed}`)
  }
  if (problems.length > 0) throw new Error(problems.join('. '))
}

function idsOf(files: Map<string, Uint8Array>, name: string): number[] {
  const parsed = JSON.parse(new TextDecoder().decode(files.get(name))) as {
    objects: { municipios: { geometries: { id: number }[] } }
  }
  return parsed.objects.municipios.geometries.map((geometry) => geometry.id)
}

/**
 * Checks the written files: each municipality in `br.json` and in its own state's file, each
 * state with a municipality in a file, and no other area besides the lagoons.
 */
export function checkOutput(
  files: Map<string, Uint8Array>,
  municipalities: Map<number, string>,
  lagoons: number[],
): void {
  const brazil = idsOf(files, 'br.json')
  checkJoin(new Map(brazil.map((id) => [id, ''])), municipalities, lagoons)
  const problems: string[] = []
  const inStates = new Set<number>()
  for (const [code, area] of Object.entries(STATE_CODES)) {
    const name = `${area}.json`
    const expected = [...municipalities.keys()].some((id) => stateCodeOf(id) === code)
    if (!files.has(name)) {
      if (expected) problems.push(`no file for the state ${area}`)
      continue
    }
    for (const id of idsOf(files, name)) {
      if (stateCodeOf(id) !== code) problems.push(`${name} holds ${label(id, municipalities)}`)
      inStates.add(id)
    }
  }
  const outside = brazil.filter((id) => !inStates.has(id))
  if (outside.length > 0) {
    const listed = outside.map((id) => label(id, municipalities)).join(', ')
    problems.push(`no state file holds ${listed}`)
  }
  if (problems.length > 0) throw new Error(problems.join('. '))
}

/** Keeps the IBGE code as each area's id, and names the one object `municipios`. */
function topology(json: string): Uint8Array {
  const parsed = JSON.parse(json) as {
    objects: Record<string, { geometries: Record<string, unknown>[] }>
  }
  const [layer] = Object.values(parsed.objects)
  if (layer === undefined) throw new Error('mapshaper wrote a topology with no object')
  for (const geometry of layer.geometries) delete geometry.properties
  parsed.objects = { municipios: layer }
  return new TextEncoder().encode(JSON.stringify(parsed))
}

function checkBudget(name: string, bytes: Uint8Array, output: OutputSettings): void {
  if (bytes.length > output.maxBytes) {
    throw new Error(`${name} is ${bytes.length} bytes, over its budget of ${output.maxBytes}`)
  }
}

/** The settings as the manifest records them. */
export function describeSettings(settings: GeoSettings) {
  const output = (values: OutputSettings) => ({
    intervaloM: values.intervalM,
    quantizacao: values.quantization,
    limiteBytes: values.maxBytes,
  })
  return {
    projecao: settings.projection,
    distanciaMaximaKm: settings.farPartKm,
    brasil: output(settings.brazil),
    estado: output(settings.state),
  }
}

/** Fails unless the zip has the pinned SHA-512. */
export function checkSource(zip: Uint8Array, source: GeoSource): void {
  const sha512 = createHash('sha512').update(zip).digest('hex')
  if (sha512 !== source.sha512) {
    throw new Error(`the source's SHA-512 is ${sha512}, but geo-assets.ts pins ${source.sha512}`)
  }
}

/** Every staged file by name, in memory. Writes nothing. */
export async function stageGeoAssets(input: StageInput): Promise<Map<string, Uint8Array>> {
  const source = input.source ?? GEO_SOURCE
  const settings = input.settings ?? GEO_SETTINGS
  const lagoons = input.lagoons ?? LAGOONS
  checkSource(input.zip, source)

  const { rows, parts } = await explodeSource(input.zip, source, settings, input.only)
  checkStates(rows)
  const areas = new Map(rows.map((row) => [row.CD_MUN, row.NM_MUN]))
  checkJoin(areas, input.municipalities, lagoons)
  const dropped = farParts(rows, settings.farPartKm)
  checkDrops(dropped, input.expectedDrops ?? EXPECTED_DROPS, new Set(areas.keys()))

  const dropFilter =
    dropped.length === 0
      ? ''
      : `-filter "[${dropped.map((part) => part.part).join(',')}].indexOf(PART) == -1"`
  const base = shapefile(
    await mapshaper.applyCommands(
      `-i parts.shp ${dropFilter} -dissolve CD_MUN copy-fields=CD_UF -o format=shapefile base.shp`,
      parts,
    ),
    'base',
  )

  const files = new Map<string, Uint8Array>()
  const brazil = settings.brazil
  const brazilOut = await mapshaper.applyCommands(
    `-i base.shp -simplify interval=${brazil.intervalM} keep-shapes planar -filter-fields CD_MUN ` +
      `-o format=topojson quantization=${brazil.quantization} id-field=CD_MUN bbox br.json`,
    base,
  )
  files.set('br.json', topology(text(brazilOut['br.json'])))

  const state = settings.state
  const stateOut = await mapshaper.applyCommands(
    `-i base.shp -simplify interval=${state.intervalM} keep-shapes planar -split CD_UF ` +
      `-filter-fields CD_MUN -o format=topojson quantization=${state.quantization} ` +
      'id-field=CD_MUN bbox singles',
    base,
  )
  for (const [name, content] of Object.entries(stateOut)) {
    const code = /(\d{2})\.json$/.exec(name)?.[1]
    const area = code === undefined ? undefined : STATE_CODES[code]
    if (area === undefined) throw new Error(`mapshaper wrote ${name}, which names no state`)
    files.set(`${area}.json`, topology(text(content)))
  }

  for (const [name, bytes] of files) {
    checkBudget(name, bytes, name === 'br.json' ? brazil : state)
  }
  checkOutput(files, input.municipalities, lagoons)

  const names = [...files.keys()].sort()
  const manifest = {
    edicao: GEO_EDITION,
    fonte: { url: source.url, sha512: source.sha512, bytes: source.bytes },
    credito: { pt: GEO_CREDIT.pt, en: GEO_CREDIT.en, termos: GEO_CREDIT.terms },
    commit: input.commit,
    versaoDados: input.dataVersion,
    mapshaper: MAPSHAPER_VERSION,
    parametros: describeSettings(settings),
    partesRemovidas: dropped.map(({ municipio, nome, areaKm2, distanciaKm }) => ({
      municipio,
      nome,
      areaKm2,
      distanciaKm,
    })),
    areasSemMunicipio: [...areas.keys()]
      .filter((code) => lagoons.includes(code))
      .sort((a, b) => a - b),
    arquivos: names.map((name) => {
      const bytes = files.get(name) as Uint8Array
      return { path: name, bytes: bytes.length, sha256: sha256Of(bytes) }
    }),
  }
  files.set('manifest.json', new TextEncoder().encode(`${JSON.stringify(manifest, null, 1)}\n`))
  const sums = [...files]
    .map(([name, bytes]) => `${sha256Of(bytes)}  ${name}`)
    .sort()
    .join('\n')
  files.set('SHA256SUMS', new TextEncoder().encode(`${sums}\n`))
  return files
}

/**
 * Stages into `target`, which it writes only after every check passes. It replaces an earlier
 * staging there, and refuses a folder that holds anything else.
 */
export async function stageToFolder(
  target: string,
  input: StageInput,
): Promise<Map<string, Uint8Array>> {
  const existing = await readdir(target, { withFileTypes: true }).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  })
  const foreign = existing
    .filter((entry) => !entry.isFile() || !STAGED_NAMES.has(entry.name))
    .map((entry) => entry.name)
  if (foreign.length > 0) {
    throw new Error(`${target} holds ${foreign.join(', ')}, which no staging writes`)
  }
  const files = await stageGeoAssets(input)
  await rm(target, { recursive: true, force: true })
  await mkdir(target, { recursive: true })
  for (const [name, bytes] of files) await writeFile(path.join(target, name), bytes)
  return files
}

/**
 * The municipalities with an IBGE code in round 1's checked list, with their names. Round 2
 * holds the same municipalities.
 */
export async function municipalitiesByCode(source: DataSource): Promise<Map<number, string>> {
  const { manifest } = await readManifest(source, 1, DATA_VERSIONS[1].manifestSha256)
  const municipalities = await readMunicipalities(source, manifest)
  if (source.mode === 'published') {
    await cachePublishedExtension(`${WORKER_URL}/assets/duckdb-wasm/${duckdbPackageVersion()}`)
  }
  const folder = await mkdtemp(path.join(os.tmpdir(), 'geo-'))
  try {
    const file = path.join(folder, 'municipios.parquet')
    await writeFile(file, municipalities)
    const run = await nodeRunner()
    const rows = await run('SELECT ibge, nome FROM read_parquet(?) WHERE ibge IS NOT NULL', [file])
    return new Map(rows.map((row) => [Number(row.ibge), String(row.nome)]))
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
}

/**
 * The source zip from a file, or downloaded. Both give a plain Uint8Array, so a local run with
 * a file takes the same path as the publish job's download.
 */
export async function loadSource(
  file: string | undefined,
  url: string = GEO_SOURCE.url,
  fetchSource: typeof fetch = fetch,
): Promise<Uint8Array> {
  if (file !== undefined) {
    const bytes = await readFile(file)
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  const response = await fetchSource(url, { signal: AbortSignal.timeout(900_000) })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

async function summarize(files: Map<string, Uint8Array>): Promise<void> {
  const summary = process.env.GITHUB_STEP_SUMMARY
  if (summary === undefined) return
  const manifest = JSON.parse(new TextDecoder().decode(files.get('manifest.json'))) as {
    partesRemovidas: DroppedPart[]
  }
  const lines = ['### Staged boundaries', '', '| File | Bytes |', '|---|---|']
  for (const [name, bytes] of files) lines.push(`| \`${name}\` | ${bytes.length} |`)
  lines.push('', 'Dropped parts:', '')
  for (const part of manifest.partesRemovidas) {
    lines.push(`- ${part.municipio} ${part.nome}: ${part.areaKm2} km², ${part.distanciaKm} km away`)
  }
  await writeFile(summary, `${lines.join('\n')}\n`, { flag: 'a' })
}

const USAGE = 'usage: stage-geo-assets.ts <folder> <commit> [--source <zip>] [--fixtures]'

/** Reads the command line, and fails on an unknown option or a missing value. */
export function parseCommandLine(args: string[]): {
  target: string
  commit: string
  source?: string
  fixtures: boolean
} {
  const { values, positionals } = parseArgs({
    args,
    options: { source: { type: 'string' }, fixtures: { type: 'boolean', default: false } },
    allowPositionals: true,
    strict: true,
  })
  const [target, commit] = positionals
  if (positionals.length !== 2 || target === undefined || commit === undefined) {
    throw new Error(USAGE)
  }
  return { target, commit, source: values.source, fixtures: values.fixtures }
}

async function main(args: string[]): Promise<void> {
  const options = parseCommandLine(args)
  const zip = await loadSource(options.source)
  checkSource(zip, GEO_SOURCE)
  const source = options.fixtures ? fixtureSource() : publishedSource(versionUrl(DATA_VERSIONS[1]))
  const municipalities = await municipalitiesByCode(source)
  const files = await stageToFolder(path.resolve(options.target), {
    zip,
    municipalities,
    dataVersion: options.fixtures ? 'fixtures' : DATA_VERSIONS[1].name,
    commit: options.commit,
    only: options.fixtures ? new Set(municipalities.keys()) : undefined,
  })
  await summarize(files)
  console.error(`staged ${files.size} files into ${options.target}`)
  // The DuckDB runner keeps a Node worker alive.
  process.exit(0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(`stage-geo-assets failed: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  })
}
