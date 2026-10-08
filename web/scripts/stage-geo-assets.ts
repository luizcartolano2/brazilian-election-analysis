/**
 * Stages IBGE's municipal boundaries for the publish workflow: projected and simplified
 * TopoJSON for Brazil and for each state, then `manifest.json`, then a SHA256SUMS list.
 */
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import mapshaper from 'mapshaper'
import { DATA_VERSION } from '../src/data-version'
import { duckdbPackageVersion, sha256Of } from './duckdb-assets'
import { nodeRunner } from './duckdb-node'
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
} from './geo-assets'
import {
  fixtureSource,
  loadVersion,
  publishedSource,
  verifyPublishedAssets,
  type DataSource,
} from './prepare-data'

export interface StageInput {
  zip: Uint8Array
  /** IBGE codes of the municipalities in the data version's list. */
  municipalities: Set<number>
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

interface PartRow {
  PART: number
  CD_MUN: number
  NM_MUN: string
  AREA: number
  BOUNDS: string
}

type Files = Record<string, string | Uint8Array>

const MAPSHAPER_VERSION = (
  createRequire(import.meta.url)('mapshaper/package.json') as { version: string }
).version

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

function bounds(row: PartRow): number[] {
  return row.BOUNDS.split(',').map(Number)
}

/** The gap between two bounding boxes, in projected meters. */
function gap(first: number[], second: number[]): number {
  const [ax0 = 0, ay0 = 0, ax1 = 0, ay1 = 0] = first
  const [bx0 = 0, by0 = 0, bx1 = 0, by1 = 0] = second
  return Math.hypot(Math.max(0, bx0 - ax1, ax0 - bx1), Math.max(0, by0 - ay1, ay0 - by1))
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

/** Fails on a far part that the list does not expect, or on a listed part that stayed. */
export function checkDrops(
  found: DroppedPart[],
  expected: ExpectedDrop[],
  present: Set<number>,
): void {
  const matches = (part: DroppedPart, drop: ExpectedDrop) =>
    part.municipio === drop.municipio && part.areaKm2 === drop.areaKm2
  const problems: string[] = []
  for (const part of found) {
    if (!expected.some((drop) => matches(part, drop))) {
      problems.push(
        `an unexpected far part of ${part.municipio} (${part.nome}): ${part.areaKm2} km², ${part.distanciaKm} km from its largest part`,
      )
    }
  }
  for (const drop of expected) {
    if (present.has(drop.municipio) && !found.some((part) => matches(part, drop))) {
      problems.push(`EXPECTED_DROPS lists ${drop.nome}, ${drop.areaKm2} km², which stayed`)
    }
  }
  if (problems.length > 0) {
    throw new Error(`${problems.join('. ')}. Review each part, then update EXPECTED_DROPS`)
  }
}

/** Fails unless each municipality has an area, and each area a municipality or a lagoon. */
export function checkJoin(
  areas: Set<number>,
  municipalities: Set<number>,
  lagoons: number[],
): void {
  const missing = [...municipalities].filter((code) => !areas.has(code)).sort((a, b) => a - b)
  const unmatched = [...areas]
    .filter((code) => !municipalities.has(code) && !lagoons.includes(code))
    .sort((a, b) => a - b)
  const problems: string[] = []
  if (missing.length > 0) problems.push(`no boundary for the municipalities ${missing.join(', ')}`)
  if (unmatched.length > 0) problems.push(`no municipality for the areas ${unmatched.join(', ')}`)
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

/** Every staged file by name, in memory. Writes nothing. */
export async function stageGeoAssets(input: StageInput): Promise<Map<string, Uint8Array>> {
  const source = input.source ?? GEO_SOURCE
  const settings = input.settings ?? GEO_SETTINGS
  const lagoons = input.lagoons ?? LAGOONS
  const sha512 = createHash('sha512').update(input.zip).digest('hex')
  if (sha512 !== source.sha512) {
    throw new Error(`the source's SHA-512 is ${sha512}, but geo-assets.ts pins ${source.sha512}`)
  }

  // Codes reach these expressions only as numbers.
  const keep =
    input.only === undefined ? '' : `-filter "[${[...input.only].join(',')}].indexOf(+CD_MUN) > -1"`
  const exploded = await mapshaper.applyCommands(
    `-i source.zip -target ${source.layer} ${keep} -filter-fields CD_MUN,NM_MUN,CD_UF ` +
      `-each "CD_MUN=+CD_MUN" -proj ${settings.projection} -explode ` +
      `-each "PART=this.id, AREA=this.area, BOUNDS=this.bounds.join(',')" ` +
      '-o format=json parts.json -o format=shapefile parts.shp',
    { 'source.zip': input.zip },
  )
  const rows = JSON.parse(text(exploded['parts.json'])) as PartRow[]
  const areas = new Set(rows.map((row) => row.CD_MUN))
  checkJoin(areas, input.municipalities, lagoons)
  const dropped = farParts(rows, settings.farPartKm)
  checkDrops(dropped, input.expectedDrops ?? EXPECTED_DROPS, areas)

  const dropFilter =
    dropped.length === 0
      ? ''
      : `-filter "[${dropped.map((part) => part.part).join(',')}].indexOf(PART) == -1"`
  const base = shapefile(
    await mapshaper.applyCommands(
      `-i parts.shp ${dropFilter} -dissolve CD_MUN copy-fields=CD_UF -o format=shapefile base.shp`,
      shapefile(exploded, 'parts'),
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

  checkBudget('br.json', files.get('br.json') as Uint8Array, brazil)
  for (const [name, bytes] of files) if (name !== 'br.json') checkBudget(name, bytes, state)

  const names = [...files.keys()].sort()
  const manifest = {
    edicao: GEO_EDITION,
    fonte: { url: source.url, sha512: source.sha512, bytes: source.bytes },
    credito: GEO_CREDIT,
    commit: input.commit,
    mapshaper: MAPSHAPER_VERSION,
    parametros: settings,
    partesRemovidas: dropped.map(({ municipio, nome, areaKm2, distanciaKm }) => ({
      municipio,
      nome,
      areaKm2,
      distanciaKm,
    })),
    areasSemMunicipio: [...areas].filter((code) => lagoons.includes(code)).sort((a, b) => a - b),
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

/** Stages into `target`, which it writes only after every check passes. */
export async function stageToFolder(
  target: string,
  input: StageInput,
): Promise<Map<string, Uint8Array>> {
  const files = await stageGeoAssets(input)
  await rm(target, { recursive: true, force: true })
  await mkdir(target, { recursive: true })
  for (const [name, bytes] of files) await writeFile(path.join(target, name), bytes)
  return files
}

/** The IBGE codes in a data version's municipality list, after checking it. */
export async function municipalityCodes(source: DataSource): Promise<Set<number>> {
  const { municipalities } = await loadVersion(source)
  if (source.mode === 'published') {
    await verifyPublishedAssets(
      `${DATA_VERSION.workerUrl}/assets/duckdb-wasm/${duckdbPackageVersion()}`,
    )
  }
  const folder = await mkdtemp(path.join(os.tmpdir(), 'geo-'))
  try {
    const file = path.join(folder, 'municipios.parquet')
    await writeFile(file, municipalities)
    const run = await nodeRunner()
    const rows = await run('SELECT ibge FROM read_parquet(?) WHERE ibge IS NOT NULL', [file])
    return new Set(rows.map((row) => Number(row.ibge)))
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
}

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { signal: AbortSignal.timeout(900_000) })
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

/** Usage: stage-geo-assets.ts <folder> <commit> [--source <zip>] [--fixtures] */
async function main(args: string[]): Promise<void> {
  const fixtures = args.includes('--fixtures')
  const sourceAt = args.indexOf('--source')
  const sourcePath = sourceAt === -1 ? undefined : args[sourceAt + 1]
  const [target, commit] = args.filter(
    (arg, index) => !arg.startsWith('--') && (sourceAt === -1 || index !== sourceAt + 1),
  )
  if (target === undefined || commit === undefined) {
    throw new Error('usage: stage-geo-assets.ts <folder> <commit> [--source <zip>] [--fixtures]')
  }
  const zip = sourcePath === undefined ? await download(GEO_SOURCE.url) : await readFile(sourcePath)
  const municipalities = await municipalityCodes(fixtures ? fixtureSource() : publishedSource())
  const files = await stageToFolder(path.resolve(target), {
    zip,
    municipalities,
    commit,
    only: fixtures ? municipalities : undefined,
  })
  await summarize(files)
  console.error(`staged ${files.size} files into ${target}`)
  // The DuckDB runner keeps a Node worker alive.
  process.exit(0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(`stage-geo-assets failed: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  })
}
