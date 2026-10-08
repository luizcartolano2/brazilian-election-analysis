import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, readdir, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import mapshaper from 'mapshaper'
import { beforeAll, describe, expect, it } from 'vitest'
import { fixtureSource } from './prepare-data'
import { GEO_SETTINGS, STATE_CODES, type ExpectedDrop, type GeoSettings } from './geo-assets'
import {
  municipalityCodes,
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

// A far island about 160 km east of the mainland square, and an island-only municipality
// about 3 km wide, smaller than the Brazil map's simplification interval.
function collection(extraIslandFor?: number) {
  const features = [
    area(MAINLAND, '11', [square(-63, -10, 0.5), square(-61, -10, 0.05)]),
    area(ISLAND_ONLY, '26', [square(-32.45, -3.87, 0.03)]),
    area(RECIFE, '26', [
      square(-35, -8.1, 0.2),
      ...(extraIslandFor === RECIFE ? [square(-33, -8.1, 0.02)] : []),
    ]),
    area(LAGOON, '43', [square(-51.5, -31, 0.3)]),
  ]
  return JSON.stringify({ type: 'FeatureCollection', features })
}

async function zipOf(geojson: string): Promise<Uint8Array> {
  const out = await mapshaper.applyCommands(
    '-i synthetic.json -proj init=EPSG:4674 -o format=shapefile zip synthetic.shp',
    { 'synthetic.json': geojson },
  )
  const zip = out['output.zip']
  if (zip === undefined || typeof zip === 'string') throw new Error('mapshaper wrote no zip')
  return zip
}

function sha512(bytes: Uint8Array): string {
  return createHash('sha512').update(bytes).digest('hex')
}

let zip: Uint8Array
let island: ExpectedDrop

function input(overrides: Partial<StageInput> = {}): StageInput {
  return {
    zip,
    municipalities: new Set([MAINLAND, ISLAND_ONLY, RECIFE]),
    commit: 'test',
    source: { url: 'synthetic', sha512: sha512(zip), bytes: zip.length, layer: 'synthetic' },
    expectedDrops: [island],
    ...overrides,
  }
}

function topology(files: Map<string, Uint8Array>, name: string) {
  return JSON.parse(new TextDecoder().decode(files.get(name))) as {
    arcs: number[][][]
    objects: { municipios: { geometries: { id: number; arcs: unknown; type: string }[] } }
  }
}

function manifest(files: Map<string, Uint8Array>) {
  return JSON.parse(new TextDecoder().decode(files.get('manifest.json'))) as {
    partesRemovidas: { municipio: number; areaKm2: number; distanciaKm: number }[]
    areasSemMunicipio: number[]
  }
}

beforeAll(async () => {
  zip = await zipOf(collection())
  // The island's area depends on the projection, so a first run with no list names it.
  const error = await stageGeoAssets({ ...input(), expectedDrops: [] }).catch((e: Error) => e)
  const areaKm2 = /: ([\d.]+) km²/.exec(String(error))?.[1]
  island = { municipio: MAINLAND, nome: 'island', areaKm2: Number(areaKm2) }
})

describe('stageGeoAssets', () => {
  it('stops with no output when the source has another SHA-512', async () => {
    const target = path.join(await mkdtemp(path.join(os.tmpdir(), 'geo-')), 'out')
    const wrong = { ...input().source!, sha512: 'f'.repeat(128) }

    await expect(stageToFolder(target, input({ source: wrong }))).rejects.toThrow(/SHA-512/)
    expect(existsSync(target)).toBe(false)
  })

  it('drops a listed far island, and records it', async () => {
    const files = await stageGeoAssets(input())

    expect(manifest(files).partesRemovidas).toEqual([
      { municipio: MAINLAND, nome: `M${MAINLAND}`, areaKm2: island.areaKm2, distanciaKm: 162 },
    ])
    const mainland = topology(files, 'br.json').objects.municipios.geometries.find(
      (geometry) => geometry.id === MAINLAND,
    )
    expect(mainland?.type).toBe('Polygon')
  })

  it('fails on a far island that the list does not expect', async () => {
    const withExtra = await zipOf(collection(RECIFE))
    const source = { url: 'synthetic', sha512: sha512(withExtra), bytes: 0, layer: 'synthetic' }

    await expect(stageGeoAssets(input({ zip: withExtra, source }))).rejects.toThrow(
      new RegExp(`unexpected far part of ${RECIFE}`),
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
      const { arcs, objects } = topology(files, name)
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
      for (const geometry of topology(files, name).objects.municipios.geometries) {
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

  it('fails when a file exceeds its budget', async () => {
    const settings: GeoSettings = {
      ...GEO_SETTINGS,
      state: { ...GEO_SETTINGS.state, maxBytes: 100 },
    }

    await expect(stageGeoAssets(input({ settings }))).rejects.toThrow(
      /\w\w\.json is \d+ bytes, over its budget of 100/,
    )
  })

  it('fails when a municipality has no boundary', async () => {
    const municipalities = new Set([MAINLAND, ISLAND_ONLY, RECIFE, 9999999])

    await expect(stageGeoAssets(input({ municipalities }))).rejects.toThrow(
      /no boundary for the municipalities 9999999/,
    )
  })

  it('fails on an area with no municipality, unless it is a lagoon', async () => {
    const files = await stageGeoAssets(input())
    expect(manifest(files).areasSemMunicipio).toEqual([LAGOON])

    const municipalities = new Set([MAINLAND, ISLAND_ONLY])
    await expect(stageGeoAssets(input({ municipalities }))).rejects.toThrow(
      new RegExp(`no municipality for the areas ${RECIFE}$`),
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

describe('the fixture boundaries', () => {
  const FIXTURES_GEO = path.join(import.meta.dirname, '..', 'fixtures-geo')

  it('cover every fixture municipality, in the Brazil file and in its state file', async () => {
    const codes = await municipalityCodes(fixtureSource())
    const ids = async (name: string) => {
      const parsed = JSON.parse(await readFile(path.join(FIXTURES_GEO, name), 'utf-8')) as {
        objects: { municipios: { geometries: { id: number }[] } }
      }
      return new Set(parsed.objects.municipios.geometries.map((geometry) => geometry.id))
    }

    expect(codes.size).toBeGreaterThan(0)
    const brazil = await ids('br.json')
    for (const code of codes) {
      expect(brazil).toContain(code)
      expect(await ids(`${STATE_CODES[String(code).slice(0, 2)]}.json`)).toContain(code)
    }
  }, 60_000)

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
