import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdtemp, readdir, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Municipality } from '../src/lib/data'
import type { Run } from '../src/lib/drilldown/queries'
import type { Round } from '../src/lib/elections'
import { raceUnits, type CandidateVotes, type MapData } from '../src/lib/maps'
import type { Summary, SummaryRace } from '../src/lib/results'
import { nodeRunner } from './duckdb-node'
import { boundaryIds, buildMaps, checkBoundaries, colorRaceOf, readBoundaries } from './map-data'
import { fixtureSource, readManifest } from './prepare-data'

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures')
const FIXTURES_GEO = path.join(import.meta.dirname, '..', 'fixtures-geo')

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function summaries(area: string): Summary {
  return JSON.parse(
    readFileSync(path.join(FIXTURES, '2026', 't1', 'resumo', `${area}.json`), 'utf-8'),
  ) as Summary
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

/** A fixture version's inputs to `buildMaps`, read as prepare-data.ts reads them. */
async function fixtureInputs(run: Run, root: string, round: Round) {
  const source = fixtureSource(root)
  const { manifest } = await readManifest(source, round, '')
  const summaries = new Map<string, Summary>()
  const folder = path.join(root, '2026', `t${round}`, 'resumo')
  for (const file of await readdir(folder)) {
    const text = await readFile(path.join(folder, file), 'utf-8')
    summaries.set(path.basename(file, '.json'), JSON.parse(text) as Summary)
  }
  const rows = await run(
    'SELECT lower(uf) AS area, municipio, ibge, nome, capital FROM read_parquet(?)',
    [path.join(root, '2026', 'municipios.parquet')],
  )
  const municipalities: Record<string, Municipality[]> = {}
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
  return { round, run, source, manifest, summaries, municipalities, boundaries }
}

describe('buildMaps on the fixtures', () => {
  let run: Run
  let out: string
  let municipalities: Record<string, Municipality[]>

  beforeAll(async () => {
    run = await nodeRunner()
    const inputs = await fixtureInputs(run, FIXTURES, 1)
    municipalities = inputs.municipalities
    out = await mkdtemp(path.join(os.tmpdir(), 'mapas-'))
    await buildMaps({ ...inputs, out })
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
      '1-votos.json',
      '1.json',
      '3-votos.json',
      '3.json',
      '5-votos.json',
      '5.json',
      '6.json',
      '7.json',
    ])
    expect((await read('pe', 5)).kind).toBe('senate')
  })

  it("writes each President candidate's votes in every municipality of Brazil", async () => {
    const votes = JSON.parse(await readFile(path.join(out, 'br', '1-votos.json'), 'utf-8')) as {
      numbers: number[]
      rows: unknown[][]
    }
    const brazil = summaries('br').corridas.find((race) => race.cargo === 1)
    const valid = (brazil?.candidatos ?? []).filter((candidate) => candidate.destino === 'Válido')

    expect(votes.numbers.sort()).toEqual(valid.map((candidate) => candidate.numero).sort())
    expect(votes.rows).toHaveLength(8)
  })

  it('fails and names a municipality that its state file lacks', async () => {
    const source = fixtureSource()
    const { manifest } = await readManifest(source, 1, '')
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
        round: 1,
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
    const { manifest } = await readManifest(source, 1, '')
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
      buildMaps({
        round: 1,
        run,
        source,
        manifest,
        summaries,
        municipalities,
        boundaries,
        out: target,
      }),
    ).rejects.toThrow(/br.json: RECIFE \(2611606\) has no area/)
  })

  it('fails and names a municipality in the totals that the municipality list lacks', async () => {
    const source = fixtureSource()
    const { manifest } = await readManifest(source, 1, '')
    const summaries = new Map<string, Summary>()
    for (const file of await readdir(path.join(FIXTURES, '2026', 't1', 'resumo'))) {
      const text = await readFile(path.join(FIXTURES, '2026', 't1', 'resumo', file), 'utf-8')
      summaries.set(path.basename(file, '.json'), JSON.parse(text) as Summary)
    }
    const boundaries = new Map<string, Uint8Array>()
    for (const name of ['ac.json', 'pe.json', 'se.json', 'br.json']) {
      boundaries.set(name, new Uint8Array(await readFile(path.join(FIXTURES_GEO, name))))
    }
    const withoutRecife = {
      ...municipalities,
      pe: (municipalities.pe ?? []).filter((municipality) => municipality.municipio !== 25313),
    }
    const target = await mkdtemp(path.join(os.tmpdir(), 'mapas-'))

    await expect(
      buildMaps({
        round: 1,
        run,
        source,
        manifest,
        summaries,
        municipalities: withoutRecife,
        boundaries,
        out: target,
      }),
    ).rejects.toThrow(
      /pe governador: the totals hold municipality 25313, which the municipality list lacks/,
    )
  })

  it('reads the IBGE codes of a boundary file', async () => {
    const ids = boundaryIds(new Uint8Array(await readFile(path.join(FIXTURES_GEO, 'pe.json'))))

    expect(ids).toContain(2611606)
  })
})

describe('colorRaceOf', () => {
  const race = (cargo: number, votes: [number, number][]): SummaryRace =>
    ({
      cargo,
      candidatos: votes.map(([numero, votos]) => ({
        numero,
        nome: `N${numero}`,
        partido: 'P',
        votos,
        destino: 'Válido',
        resultado: '',
      })),
    }) as SummaryRace
  const version = (areas: Record<string, SummaryRace[]>) =>
    new Map(
      Object.entries(areas).map(([area, corridas]) => [area, { corridas } as unknown as Summary]),
    )
  const first = version({
    br: [
      race(1, [
        [22, 50],
        [13, 40],
        [70, 10],
      ]),
    ],
    rj: [
      race(1, [
        [13, 60],
        [22, 30],
      ]),
      race(3, [
        [10, 45],
        [40, 35],
        [55, 20],
      ]),
    ],
  })
  const second = version({
    br: [
      race(1, [
        [13, 55],
        [22, 45],
      ]),
    ],
    rj: [
      race(1, [
        [13, 70],
        [22, 30],
      ]),
      race(3, [
        [40, 60],
        [10, 40],
      ]),
    ],
  })

  it('ranks round 1 by Brazil for President and by the state for the other races', () => {
    const rj = first.get('rj')?.corridas ?? []
    expect(colorRaceOf(rj[0] as SummaryRace, 'rj', first)).toBe(first.get('br')?.corridas[0])
    expect(colorRaceOf(rj[1] as SummaryRace, 'rj', first)).toBe(rj[1])
  })

  it('keeps round 1’s order for round 2’s finalists, whoever wins round 2', () => {
    const rj = second.get('rj')?.corridas ?? []
    const president = colorRaceOf(rj[0] as SummaryRace, 'rj', second, first)
    const governor = colorRaceOf(rj[1] as SummaryRace, 'rj', second, first)
    expect(raceUnits(rj[0] as SummaryRace, false, new Map(), president).units).toEqual([
      'N22 (P)',
      'N13 (P)',
    ])
    expect(raceUnits(rj[1] as SummaryRace, false, new Map(), governor).units).toEqual([
      'N10 (P)',
      'N40 (P)',
    ])
  })
})

describe('buildMaps on the round-2 fixtures', () => {
  const FIXTURES_T2 = path.join(import.meta.dirname, '..', 'fixtures-t2')
  let out: string

  beforeAll(async () => {
    const run = await nodeRunner()
    const first = await fixtureInputs(run, FIXTURES, 1)
    out = await mkdtemp(path.join(os.tmpdir(), 'mapas-t2-'))
    await buildMaps({
      ...(await fixtureInputs(run, FIXTURES_T2, 2)),
      colorSummaries: first.summaries,
      out,
    })
  }, 60_000)

  it('maps President everywhere and Governor only in the runoff state', async () => {
    const written = async (area: string) => (await readdir(path.join(out, area))).sort()
    expect(await written('ac')).toEqual(['1-votos.json', '1.json', '3-votos.json', '3.json'])
    expect(await written('pe')).toEqual(['1-votos.json', '1.json'])
    expect(await written('br')).toEqual(['1-votos.json', '1.json'])
  })

  it('ranks the finalists by round 1, and lists no one else', async () => {
    const read = async (area: string, race: number) =>
      JSON.parse(await readFile(path.join(out, area, `${race}.json`), 'utf-8')) as MapData
    expect((await read('ac', 3)).units).toEqual(['MAILZA ASSIS (PP)', 'ALAN RICK (REPUBLICANOS)'])
    expect((await read('pe', 1)).units).toEqual(['FLAVIO BOLSONARO (PL)', 'LULA (PT)'])
  })

  it('holds the two finalists only in the candidate votes', async () => {
    const votes = JSON.parse(
      await readFile(path.join(out, 'ac', '3-votos.json'), 'utf-8'),
    ) as CandidateVotes
    expect([...votes.numbers].sort()).toEqual([10, 11])
  })
})
