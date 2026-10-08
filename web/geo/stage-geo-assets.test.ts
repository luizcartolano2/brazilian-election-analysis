import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import mapshaper from 'mapshaper'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  GEO_CREDIT,
  GEO_EDITION,
  GEO_SETTINGS,
  GEO_SOURCE,
  STATE_CODES,
  type ExpectedDrop,
  type GeoSettings,
  type GeoSource,
} from '../scripts/geo-assets'
import { fixtureSource } from '../scripts/prepare-data'
import {
  checkOutput,
  describeSettings,
  explodeSource,
  farParts,
  municipalitiesByCode,
  parseCommandLine,
  stageGeoAssets,
  stageToFolder,
  type StageInput,
} from './stage-geo-assets'

type Ring = number[][]

function square(x: number, y: number, size: number): Ring[] {
  return [
    [
      [x, y],
      [x + size, y],
      [x + size, y + size],
      [x, y + size],
      [x, y],
    ],
  ]
}

function area(code: number, state: string, polygons: Ring[][]) {
  return {
    type: 'Feature',
    properties: { CD_MUN: String(code), NM_MUN: `M${code}`, CD_UF: state, AREA_KM2: 1, NOTE: 'x' },
    geometry: { type: 'MultiPolygon', coordinates: polygons },
  }
}

const MAINLAND = 1100015
const ISLAND_ONLY = 2605459
const RECIFE = 2611606
const LAGOON = 4300001
const MUNICIPALITIES = new Map([
  [MAINLAND, 'MAINLAND'],
  [ISLAND_ONLY, 'ISLAND ONLY'],
  [RECIFE, 'RECIFE'],
])

interface Variant {
  extraIslandFor?: number
  twinIslands?: boolean
  recifeState?: string
}

// A far island about 160 km east of the mainland square, and an island-only municipality
// about 3 km wide, smaller than the Brazil map's simplification interval.
function collection(variant: Variant = {}) {
  const features = [
    area(MAINLAND, '11', [
      square(-63, -10, 0.5),
      square(-61, -10, 0.05),
      ...(variant.twinIslands ? [square(-60.5, -10, 0.05)] : []),
    ]),
    area(ISLAND_ONLY, '26', [square(-32.45, -3.87, 0.03)]),
    area(RECIFE, variant.recifeState ?? '26', [
      square(-35, -8.1, 0.2),
      ...(variant.extraIslandFor === RECIFE ? [square(-33, -8.1, 0.02)] : []),
    ]),
    area(LAGOON, '43', [square(-51.5, -31, 0.3)]),
  ]
  return JSON.stringify({ type: 'FeatureCollection', features })
}

async function zipOf(variant: Variant = {}): Promise<{ zip: Uint8Array; source: GeoSource }> {
  const out = await mapshaper.applyCommands(
    '-i synthetic.json -proj init=EPSG:4674 -o format=shapefile zip synthetic.shp',
    { 'synthetic.json': collection(variant) },
  )
  const zip = out['output.zip']
  if (zip === undefined || typeof zip === 'string') throw new Error('mapshaper wrote no zip')
  const sha512 = createHash('sha512').update(zip).digest('hex')
  return { zip, source: { url: 'synthetic', sha512, bytes: zip.length, layer: 'synthetic' } }
}

let plain: { zip: Uint8Array; source: GeoSource }
let island: ExpectedDrop

function input(overrides: Partial<StageInput> = {}): StageInput {
  return {
    zip: plain.zip,
    source: plain.source,
    municipalities: MUNICIPALITIES,
    dataVersion: 'test-version',
    commit: 'test',
    expectedDrops: [island],
    ...overrides,
  }
}

function decode(bytes: Uint8Array | undefined) {
  return JSON.parse(new TextDecoder().decode(bytes)) as {
    arcs: number[][][]
    objects: { municipios: { geometries: { id: number; arcs: unknown; type: string }[] } }
  }
}

function manifest(files: Map<string, Uint8Array>) {
  return JSON.parse(new TextDecoder().decode(files.get('manifest.json'))) as Record<
    string,
    unknown
  > & { partesRemovidas: unknown[]; areasSemMunicipio: number[] }
}

function topologyWith(ids: number[]): Uint8Array {
  const geometries = ids.map((id) => ({ arcs: [[0]], type: 'Polygon', id }))
  return new TextEncoder().encode(JSON.stringify({ objects: { municipios: { geometries } } }))
}

beforeAll(async () => {
  plain = await zipOf()
  const { rows } = await explodeSource(plain.zip, plain.source, GEO_SETTINGS)
  const [part] = farParts(rows, GEO_SETTINGS.farPartKm)
  if (part === undefined) throw new Error('the synthetic island is not far')
  island = { municipio: part.municipio, nome: 'island', areaKm2: part.areaKm2 }
})

describe('stageGeoAssets', () => {
  it('stops with no output when the source has another SHA-512', async () => {
    const target = path.join(await mkdtemp(path.join(os.tmpdir(), 'geo-')), 'out')
    const wrong = { ...plain.source, sha512: 'f'.repeat(128) }

    await expect(stageToFolder(target, input({ source: wrong }))).rejects.toThrow(/SHA-512/)
    expect(existsSync(target)).toBe(false)
  })

  it('drops a listed far island, and records it', async () => {
    const files = await stageGeoAssets(input())

    expect(manifest(files).partesRemovidas).toEqual([
      { municipio: MAINLAND, nome: `M${MAINLAND}`, areaKm2: island.areaKm2, distanciaKm: 162 },
    ])
    const mainland = decode(files.get('br.json')).objects.municipios.geometries.find(
      (geometry) => geometry.id === MAINLAND,
    )
    expect(mainland?.type).toBe('Polygon')
  })

  it('fails on a far island that the list does not expect', async () => {
    const extra = await zipOf({ extraIslandFor: RECIFE })

    await expect(stageGeoAssets(input(extra))).rejects.toThrow(
      new RegExp(`unexpected far part of ${RECIFE}`),
    )
  })

  it('matches each listed part once', async () => {
    const twins = await zipOf({ twinIslands: true })

    await expect(stageGeoAssets(input(twins))).rejects.toThrow(
      new RegExp(`unexpected far part of ${MAINLAND}`),
    )
  })

  it('fails when a listed part stays', async () => {
    const stale = { municipio: MAINLAND, nome: 'gone', areaKm2: 1.234 }

    await expect(stageGeoAssets(input({ expectedDrops: [island, stale] }))).rejects.toThrow(
      /lists gone, 1.234 km², which stayed/,
    )
  })

  it('keeps the shape of an island-only municipality', async () => {
    const files = await stageGeoAssets(input())

    for (const name of ['br.json', 'pe.json']) {
      const { arcs, objects } = decode(files.get(name))
      const noronha = objects.municipios.geometries.find((geometry) => geometry.id === ISLAND_ONLY)
      const [ring] = (noronha?.arcs ?? []) as number[][]
      const points = (ring ?? []).reduce(
        (total, index) => total + (arcs[index < 0 ? ~index : index]?.length ?? 0),
        0,
      )
      expect(points).toBeGreaterThanOrEqual(4)
    }
  })

  it('keeps the IBGE code as the only attribute', async () => {
    const files = await stageGeoAssets(input())

    for (const [name, bytes] of files) {
      if (!name.endsWith('.json') || name === 'manifest.json') continue
      for (const geometry of decode(bytes).objects.municipios.geometries) {
        expect(Object.keys(geometry).sort()).toEqual(['arcs', 'id', 'type'])
        expect(typeof geometry.id).toBe('number')
      }
      expect(new TextDecoder().decode(bytes)).not.toMatch(/NM_MUN|AREA_KM2|NOTE|M1100015/)
    }
  })

  it('names each state file by its area code', async () => {
    const files = await stageGeoAssets(input())

    expect([...files.keys()].sort()).toEqual([
      'SHA256SUMS',
      'br.json',
      'manifest.json',
      'pe.json',
      'ro.json',
      'rs.json',
    ])
  })

  it('records the source, the commit, the data version, the tool and the settings', async () => {
    const files = await stageGeoAssets(input())

    expect(manifest(files)).toMatchObject({
      edicao: GEO_EDITION,
      fonte: { url: 'synthetic', sha512: plain.source.sha512, bytes: plain.zip.length },
      credito: { pt: GEO_CREDIT.pt, en: GEO_CREDIT.en, termos: GEO_CREDIT.terms },
      commit: 'test',
      versaoDados: 'test-version',
      mapshaper: createRequire(import.meta.url)('mapshaper/package.json').version,
      parametros: describeSettings(GEO_SETTINGS),
    })
  })

  it.each([
    ['br.json', 'brazil'],
    ['\\w\\w\\.json', 'state'],
  ] as const)('fails when %s exceeds its budget', async (name, output) => {
    const settings: GeoSettings = {
      ...GEO_SETTINGS,
      [output]: { ...GEO_SETTINGS[output], maxBytes: 100 },
    }

    await expect(stageGeoAssets(input({ settings }))).rejects.toThrow(
      new RegExp(`${name} is \\d+ bytes, over its budget of 100`),
    )
  })

  it('fails when a municipality has no boundary, and names it', async () => {
    const municipalities = new Map([...MUNICIPALITIES, [9999999, 'NOWHERE']])

    await expect(stageGeoAssets(input({ municipalities }))).rejects.toThrow(
      /no boundary for the municipalities 9999999 \(NOWHERE\)/,
    )
  })

  it('fails on an area with no municipality, unless it is a lagoon', async () => {
    const files = await stageGeoAssets(input())
    expect(manifest(files).areasSemMunicipio).toEqual([LAGOON])

    const municipalities = new Map([...MUNICIPALITIES].filter(([code]) => code !== RECIFE))
    await expect(stageGeoAssets(input({ municipalities }))).rejects.toThrow(
      new RegExp(`no municipality for the areas ${RECIFE} \\(M${RECIFE}\\)$`),
    )
  })

  it('fails when an area has a state code that its IBGE code does not match', async () => {
    const misplaced = await zipOf({ recifeState: '11' })

    await expect(stageGeoAssets(input(misplaced))).rejects.toThrow(
      new RegExp(`${RECIFE} \\(M${RECIFE}\\): 11`),
    )
  })

  it('gives the same bytes on the same input', async () => {
    const first = await stageGeoAssets(input())
    const second = await stageGeoAssets(input())

    expect([...second.keys()]).toEqual([...first.keys()])
    for (const [name, bytes] of first) expect(second.get(name)).toEqual(bytes)
  })

  it('lists every file in SHA256SUMS', async () => {
    const files = await stageGeoAssets(input())
    const sums = new TextDecoder().decode(files.get('SHA256SUMS'))

    for (const [name, bytes] of files) {
      if (name === 'SHA256SUMS') continue
      expect(sums).toContain(`${createHash('sha256').update(bytes).digest('hex')}  ${name}\n`)
    }
  })
})

describe('checkOutput', () => {
  const lagoons = [LAGOON]
  const complete = () =>
    new Map([
      ['br.json', topologyWith([MAINLAND, ISLAND_ONLY, RECIFE, LAGOON])],
      ['ro.json', topologyWith([MAINLAND])],
      ['pe.json', topologyWith([ISLAND_ONLY, RECIFE])],
      ['rs.json', topologyWith([LAGOON])],
    ])

  it('passes the written files when every area is in place', () => {
    expect(() => checkOutput(complete(), MUNICIPALITIES, lagoons)).not.toThrow()
  })

  it('names a municipality that the written Brazil file lost', () => {
    const files = complete()
    files.set('br.json', topologyWith([MAINLAND, ISLAND_ONLY, LAGOON]))

    expect(() => checkOutput(files, MUNICIPALITIES, lagoons)).toThrow(
      /no boundary for the municipalities 2611606 \(RECIFE\)/,
    )
  })

  it('fails on a missing state file, a municipality in the wrong one, and one in none', () => {
    const files = complete()
    files.delete('ro.json')
    files.set('rs.json', topologyWith([LAGOON, RECIFE]))
    files.set('pe.json', topologyWith([ISLAND_ONLY]))

    expect(() => checkOutput(files, MUNICIPALITIES, lagoons)).toThrow(
      'no file for the state ro. rs.json holds 2611606 (RECIFE). no state file holds 1100015 (MAINLAND)',
    )
  })
})

describe('stageToFolder', () => {
  it('refuses a folder that holds files no staging writes', async () => {
    const target = await mkdtemp(path.join(os.tmpdir(), 'geo-'))
    await writeFile(path.join(target, 'package.json'), '{}')
    await mkdir(path.join(target, 'src'))

    await expect(stageToFolder(target, input())).rejects.toThrow(/holds package.json, src/)
    expect((await readdir(target)).sort()).toEqual(['package.json', 'src'])
  })

  it('refuses a folder named like a staged file, and a name that no staging writes', async () => {
    const target = await mkdtemp(path.join(os.tmpdir(), 'geo-'))
    await mkdir(path.join(target, 'pe.json'))
    await writeFile(path.join(target, 'zz.json'), '{}')

    await expect(stageToFolder(target, input())).rejects.toThrow(
      /holds (pe|zz)\.json, (pe|zz)\.json/,
    )
    expect((await readdir(target)).sort()).toEqual(['pe.json', 'zz.json'])
  })

  it('refuses a target that is a file, and keeps it', async () => {
    const target = path.join(await mkdtemp(path.join(os.tmpdir(), 'geo-')), 'package.json')
    await writeFile(target, '{}')

    await expect(stageToFolder(target, input())).rejects.toThrow(/ENOTDIR/)
    expect(await readFile(target, 'utf-8')).toBe('{}')
  })

  it('replaces an earlier staging', async () => {
    const target = await mkdtemp(path.join(os.tmpdir(), 'geo-'))
    await writeFile(path.join(target, 'ac.json'), '{}')

    const files = await stageToFolder(target, input())

    expect((await readdir(target)).sort()).toEqual([...files.keys()].sort())
  })
})

describe('parseCommandLine', () => {
  it('reads the folder, the commit and the options', () => {
    expect(parseCommandLine(['out', 'abc', '--fixtures', '--source', 'a.zip'])).toEqual({
      target: 'out',
      commit: 'abc',
      source: 'a.zip',
      fixtures: true,
    })
  })

  it.each([
    [['out', 'abc', '--fixture']],
    [['out', 'abc', '--source']],
    [['out']],
    [['out', 'abc', 'extra']],
  ])('refuses %j', (args) => {
    expect(() => parseCommandLine(args)).toThrow()
  })
})

describe('the fixture boundaries', () => {
  const FIXTURES_GEO = path.join(import.meta.dirname, '..', 'fixtures-geo')

  it('cover every fixture municipality, in the Brazil file and in its state file', async () => {
    const codes = await municipalitiesByCode(fixtureSource())
    const ids = async (name: string) =>
      new Set(
        decode(await readFile(path.join(FIXTURES_GEO, name))).objects.municipios.geometries.map(
          (geometry) => geometry.id,
        ),
      )

    expect(codes.size).toBeGreaterThan(0)
    const brazil = await ids('br.json')
    for (const code of codes.keys()) {
      expect(brazil).toContain(code)
      expect(await ids(`${STATE_CODES[String(code).slice(0, 2)]}.json`)).toContain(code)
    }
  }, 60_000)

  it('come from the current source pin, settings and mapshaper version', async () => {
    const recorded = JSON.parse(await readFile(path.join(FIXTURES_GEO, 'manifest.json'), 'utf-8'))

    expect(recorded).toMatchObject({
      edicao: GEO_EDITION,
      fonte: { url: GEO_SOURCE.url, sha512: GEO_SOURCE.sha512, bytes: GEO_SOURCE.bytes },
      credito: { pt: GEO_CREDIT.pt, en: GEO_CREDIT.en, termos: GEO_CREDIT.terms },
      versaoDados: 'fixtures',
      mapshaper: createRequire(import.meta.url)('mapshaper/package.json').version,
      parametros: describeSettings(GEO_SETTINGS),
    })
  })

  it('match their SHA256SUMS', async () => {
    const sums = await readFile(path.join(FIXTURES_GEO, 'SHA256SUMS'), 'utf-8')
    const listed = sums.trim().split('\n')

    expect(listed).toHaveLength((await readdir(FIXTURES_GEO)).length - 1)
    for (const line of listed) {
      const [sha256, name = ''] = line.split('  ')
      const bytes = await readFile(path.join(FIXTURES_GEO, name))
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256)
    }
  })
})
