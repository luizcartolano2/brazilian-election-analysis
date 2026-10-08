import { createHash } from 'node:crypto'
import { mkdtemp, readdir, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Municipality } from '../src/lib/data'
import type { Run } from '../src/lib/drilldown/queries'
import type { MapData } from '../src/lib/maps'
import type { Summary } from '../src/lib/results'
import { nodeRunner } from './duckdb-node'
import { boundaryIds, buildMaps, checkBoundaries, readBoundaries } from './map-data'
import { fixtureSource, readManifest } from './prepare-data'

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures')
const FIXTURES_GEO = path.join(import.meta.dirname, '..', 'fixtures-geo')

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

describe('readBoundaries', () => {
  const file = new TextEncoder().encode('{"type":"Topology"}')
  const pins = { 'pe.json': sha256(file) }

  it('returns each pinned file that arrives with its SHA-256', async () => {
    const files = await readBoundaries(async () => file, pins)

    expect(files.get('pe.json')).toEqual(file)
  })

  it('fails on a missing file', async () => {
    await expect(readBoundaries(async () => null, pins)).rejects.toThrow(
      'the boundary file pe.json is missing',
    )
  })

  it('fails on a changed file', async () => {
    const changed = new TextEncoder().encode('{"type":"Topology","x":1}')

    await expect(readBoundaries(async () => changed, pins)).rejects.toThrow(
      /pe.json has SHA-256 [0-9a-f]{64}, not /,
    )
  })
})

describe('checkBoundaries', () => {
  const recife: Municipality = { municipio: 25313, ibge: 2611606, nome: 'RECIFE', capital: true }

  it('passes when the municipalities and the areas match, lagoons aside', () => {
    expect(checkBoundaries('rs.json', [recife], new Set([2611606, 4300001]))).toEqual([])
  })

  it('names a municipality without an area, and one without an IBGE code', () => {
    const noCode = { ...recife, municipio: 1, ibge: null, nome: 'NOWHERE' }

    expect(checkBoundaries('pe.json', [recife, noCode], new Set())).toEqual([
      'pe.json: RECIFE (2611606) has no area',
      'pe.json: NOWHERE (1) has no IBGE code',
    ])
  })

  it('names an area that no municipality in the data has', () => {
    expect(checkBoundaries('pe.json', [recife], new Set([2611606, 2699999]))).toEqual([
      'pe.json: the area 2699999 belongs to no municipality in the data',
    ])
  })
})

describe('buildMaps on the fixtures', () => {
  let run: Run
  let out: string
  let municipalities: Record<string, Municipality[]>

  beforeAll(async () => {
    run = await nodeRunner()
    const source = fixtureSource()
    const { manifest } = await readManifest(source)
    const summaries = new Map<string, Summary>()
    for (const file of await readdir(path.join(FIXTURES, '2026', 't1', 'resumo'))) {
      const text = await readFile(path.join(FIXTURES, '2026', 't1', 'resumo', file), 'utf-8')
      summaries.set(path.basename(file, '.json'), JSON.parse(text) as Summary)
    }
    const rows = await run(
      'SELECT lower(uf) AS area, municipio, ibge, nome, capital FROM read_parquet(?)',
      [path.join(FIXTURES, '2026', 'municipios.parquet')],
    )
    municipalities = {}
    for (const row of rows) {
      ;(municipalities[String(row.area)] ??= []).push({
        municipio: Number(row.municipio),
        ibge: row.ibge === null ? null : Number(row.ibge),
        nome: String(row.nome),
        capital: Boolean(row.capital),
      })
    }
    const boundaries = new Map<string, Uint8Array>()
    for (const name of ['ac.json', 'pe.json', 'se.json', 'br.json']) {
      boundaries.set(name, new Uint8Array(await readFile(path.join(FIXTURES_GEO, name))))
    }
    out = await mkdtemp(path.join(os.tmpdir(), 'mapas-'))
    await buildMaps({ run, source, manifest, summaries, municipalities, boundaries, out })
  }, 60_000)

  async function read(area: string, race: number): Promise<MapData> {
    return JSON.parse(await readFile(path.join(out, area, `${race}.json`), 'utf-8')) as MapData
  }

  it('maps every municipality of Brazil for President, and no city abroad', async () => {
    const brazil = await read('br', 1)
    const inStates = Object.entries(municipalities)
      .filter(([area]) => area !== 'zz')
      .flatMap(([, list]) => list.map((municipality) => municipality.ibge))

    expect(brazil.rows.map((row) => row[0]).sort()).toEqual(inStates.sort())
    expect(await readdir(out)).not.toContain('zz')
  })

  it('writes a map for each race of each state', async () => {
    expect((await readdir(path.join(out, 'pe'))).sort()).toEqual([
      '1.json',
      '3.json',
      '5.json',
      '6.json',
      '7.json',
    ])
    expect((await read('pe', 5)).kind).toBe('senate')
  })

  it('fails and names a municipality that its state file lacks', async () => {
    const source = fixtureSource()
    const { manifest } = await readManifest(source)
    const summaries = new Map<string, Summary>()
    for (const area of ['br', 'pe']) {
      const text = await readFile(
        path.join(FIXTURES, '2026', 't1', 'resumo', `${area}.json`),
        'utf-8',
      )
      summaries.set(area, JSON.parse(text) as Summary)
    }
    const empty = new TextEncoder().encode(
      JSON.stringify({ objects: { municipios: { geometries: [] } } }),
    )
    const target = await mkdtemp(path.join(os.tmpdir(), 'mapas-'))

    await expect(
      buildMaps({
        run,
        source,
        manifest,
        summaries,
        municipalities,
        boundaries: new Map([['pe.json', empty]]),
        out: target,
      }),
    ).rejects.toThrow(/pe.json: RECIFE \(2611606\) has no area/)
  })

  it('fails and names a municipality that the Brazil file lacks', async () => {
    const source = fixtureSource()
    const { manifest } = await readManifest(source)
    const summaries = new Map<string, Summary>()
    for (const file of await readdir(path.join(FIXTURES, '2026', 't1', 'resumo'))) {
      const text = await readFile(path.join(FIXTURES, '2026', 't1', 'resumo', file), 'utf-8')
      summaries.set(path.basename(file, '.json'), JSON.parse(text) as Summary)
    }
    const boundaries = new Map<string, Uint8Array>()
    for (const name of ['ac.json', 'pe.json', 'se.json']) {
      boundaries.set(name, new Uint8Array(await readFile(path.join(FIXTURES_GEO, name))))
    }
    const brazil = JSON.parse(await readFile(path.join(FIXTURES_GEO, 'br.json'), 'utf-8')) as {
      objects: { municipios: { geometries: { id: number }[] } }
    }
    brazil.objects.municipios.geometries = brazil.objects.municipios.geometries.filter(
      (geometry) => geometry.id !== 2611606,
    )
    boundaries.set('br.json', new TextEncoder().encode(JSON.stringify(brazil)))
    const target = await mkdtemp(path.join(os.tmpdir(), 'mapas-'))

    await expect(
      buildMaps({ run, source, manifest, summaries, municipalities, boundaries, out: target }),
    ).rejects.toThrow(/br.json: RECIFE \(2611606\) has no area/)
  })

  it('reads the IBGE codes of a boundary file', async () => {
    const ids = boundaryIds(new Uint8Array(await readFile(path.join(FIXTURES_GEO, 'pe.json'))))

    expect(ids).toContain(2611606)
  })
})
