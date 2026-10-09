import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { nodeRunner } from '../../../scripts/duckdb-node'
import { parseAddress, racesFor } from '../address'
import { COUNCIL, raceByCode } from '../elections'
import type { Summary } from '../results'
import { loadView, NotFound, searchPlaces, type Locate, type Run } from './queries'

const FIXTURES = path.join(import.meta.dirname, '..', '..', '..', 'fixtures')
const locate: Locate = (relative) => path.join(FIXTURES, relative)
const AREA_RACES: Record<string, number[]> = {
  ac: [1, 3, 5, 6, 7],
  pe: [1, 3, 5, 6, 7],
  se: [1, 3, 5, 6, 7],
  zz: [1],
}
const SHAPES: Record<number, { seats: number; choicesPerVoter: number }> = {
  1: { seats: 1, choicesPerVoter: 1 },
  3: { seats: 1, choicesPerVoter: 1 },
  5: { seats: 2, choicesPerVoter: 2 },
  6: { seats: 25, choicesPerVoter: 1 },
  7: { seats: 49, choicesPerVoter: 1 },
  25: { seats: COUNCIL.seats, choicesPerVoter: COUNCIL.choicesPerVoter },
}

let run: Run

beforeAll(async () => {
  run = await nodeRunner()
}, 30_000)

function address(level: 'municipio' | 'zona' | 'secao', query: string) {
  const parsed = parseAddress(level, new URLSearchParams(query), AREA_RACES)
  if (parsed === null) throw new Error(`invalid address ${query}`)
  return parsed
}

function view(level: 'municipio' | 'zona' | 'secao', query: string) {
  const parsed = address(level, query)
  return loadView(run, locate, parsed, SHAPES[parsed.race.code] ?? { seats: 1, choicesPerVoter: 1 })
}

describe('loadView', () => {
  it('gives a station votes equal to its turnout times the choices per voter', async () => {
    for (const race of ['presidente', 'governador', 'senador', 'deputado-federal']) {
      const data = await view('secao', `uf=pe&mu=25313&zn=3&se=597&cargo=${race}`)
      const totals = data.results?.totals
      expect(totals?.totalVotes, race).toBe(
        (totals?.attendance ?? -1) * (data.results?.choicesPerVoter ?? 0),
      )
    }
  })

  it('adds a municipality up from its zones and its zones from their stations', async () => {
    const municipality = await view('municipio', 'uf=pe&mu=25313&cargo=governador')
    const zones = await Promise.all(
      municipality.zones.map((entry) =>
        view('zona', `uf=pe&mu=25313&zn=${entry.zone}&cargo=governador`),
      ),
    )
    const zoneValid = zones.reduce((sum, zone) => sum + (zone.results?.totals.valid ?? 0), 0)
    expect(zoneValid).toBe(municipality.results?.totals.valid)
    const first = zones[0]
    if (first === undefined) throw new Error('no zones')
    const stations = await Promise.all(
      first.stations
        .filter((entry) => !entry.aggregated)
        .map((entry) =>
          view(
            'secao',
            `uf=pe&mu=25313&zn=${municipality.zones[0]?.zone}&se=${entry.station}&cargo=governador`,
          ),
        ),
    )
    const stationValid = stations.reduce((sum, item) => sum + (item.results?.totals.valid ?? 0), 0)
    expect(stationValid).toBe(first.results?.totals.valid)
  })

  it('names candidates and parties, and keeps the deputy sums', async () => {
    const data = await view('municipio', 'uf=pe&mu=25313&cargo=deputado-estadual')
    const results = data.results
    if (results === null) throw new Error('no results')
    expect(data.municipalityName).toBe('Recife')
    expect(results.candidates[0]?.name).not.toMatch(/^\d+$/)
    const partyTotal = (results.parties ?? []).reduce((sum, party) => sum + party.total, 0)
    expect(partyTotal).toBe(results.totals.valid)
  })

  it('names the candidacy TSE classified when two share a number', async () => {
    const data = await view('municipio', 'uf=pe&mu=23051&cargo=deputado-federal')
    const shared = data.results?.candidates.find((candidate) => candidate.number === 4444)
    expect(shared?.name).toBe('Juliana de Chaparral')
  })

  it('adds the municipalities up to each state summary, candidate by candidate', async () => {
    for (const area of ['ac', 'pe', 'se', 'zz']) {
      const summary = JSON.parse(
        readFileSync(path.join(FIXTURES, '2026', 't1', 'resumo', `${area}.json`), 'utf-8'),
      ) as Summary
      const municipalities = await run(
        'SELECT municipio FROM read_parquet(?) WHERE uf = ? ORDER BY municipio',
        [locate('2026/municipios.parquet'), area.toUpperCase()],
      )
      for (const race of summary.corridas) {
        const slug = raceByCode(race.cargo)?.slug
        const votes = new Map<number, number>()
        const outcomes = new Map<number, string>()
        let blank = 0
        let valid = 0
        for (const row of municipalities) {
          const data = await view('municipio', `uf=${area}&mu=${row.municipio}&cargo=${slug}`)
          const results = data.results
          if (results === null) throw new Error('no results')
          for (const candidate of [...results.candidates, ...results.candidatesUnderAppeal]) {
            votes.set(candidate.number, (votes.get(candidate.number) ?? 0) + candidate.votes)
            outcomes.set(candidate.number, candidate.outcome)
          }
          blank += results.totals.blank
          valid += results.totals.valid
        }
        const label = `${area} race ${race.cargo}`
        for (const candidate of race.candidatos) {
          expect(votes.get(candidate.numero) ?? 0, `${label} ${candidate.numero}`).toBe(
            candidate.votos,
          )
          if (votes.has(candidate.numero)) {
            expect(outcomes.get(candidate.numero), `${label} ${candidate.numero}`).toBe(
              candidate.resultado,
            )
          }
        }
        expect(blank, label).toBe(race.brancos)
        expect(valid, label).toBe(race.validos)
      }
    }
  }, 60_000)

  it('shows the council in Fernando de Noronha with seven seats and one choice', async () => {
    const data = await view(
      'municipio',
      `uf=pe&mu=${COUNCIL.municipality}&cargo=conselheiro-distrital`,
    )
    expect(data.results?.seats).toBe(7)
    expect(data.results?.choicesPerVoter).toBe(1)
    expect(data.results?.parties).toBeNull()
    expect(data.results?.candidates.length).toBeGreaterThan(7)
  })

  it('explains an aggregated station instead of showing results', async () => {
    const data = await view('secao', 'uf=ac&mu=1015&zn=2&se=112')
    expect(data.station).toMatchObject({ aggregated: true, principal: 87 })
    expect(data.results).toBeNull()
  })

  it('reads votes cast abroad', async () => {
    const city = await view('municipio', 'uf=zz&mu=29173')
    expect(city.municipalityName).toBe('Katmandu')
    expect(city.results?.candidates.length).toBeGreaterThan(0)
  })

  it('reports a place that does not exist', async () => {
    await expect(view('municipio', 'uf=pe&mu=99999')).rejects.toBeInstanceOf(NotFound)
    await expect(view('secao', 'uf=pe&mu=25313&zn=3&se=9999')).rejects.toBeInstanceOf(NotFound)
  })
})

describe('searchPlaces', () => {
  it('finds a place by part of its name, ignoring case and accents', async () => {
    const { places, truncated } = await searchPlaces(run, locate, 1, 'pe', 30015, 'arquipelago')
    expect(truncated).toBe(false)
    expect(places).toHaveLength(1)
    expect(places[0]?.stations.length).toBeGreaterThan(1)
  })

  it('treats quotes and wildcards in the search as text', async () => {
    for (const text of ["d'água", '" OR 1=1 --', '%', '_']) {
      await expect(searchPlaces(run, locate, 1, 'pe', 30015, text), text).resolves.toEqual({
        places: [],
        truncated: false,
      })
    }
  })
})

describe('a round-2 view', () => {
  const FIXTURES_T2 = path.join(import.meta.dirname, '..', '..', '..', 'fixtures-t2')
  const locateT2: Locate = (relative) => path.join(FIXTURES_T2, relative)
  const ROUND_TWO: Record<string, number[]> = { ac: [1, 3], pe: [1], se: [1], zz: [1] }
  const ONE_CHOICE = { seats: 1, choicesPerVoter: 1 }

  function roundTwo(query: string) {
    const parsed = parseAddress('secao', new URLSearchParams(query), ROUND_TWO, 2)
    if (parsed === null) throw new Error(`invalid address ${query}`)
    return loadView(run, locateT2, parsed, ONE_CHOICE)
  }

  it('reads a station from the round-2 version, with the two finalists only', async () => {
    const governor = await roundTwo('uf=ac&mu=1392&zn=9&se=228&cargo=governador')
    expect(governor.results?.candidates.map((entry) => entry.number).sort()).toEqual([10, 11])
    expect(governor.results?.totals.totalVotes).toBe(governor.results?.totals.attendance)
    const president = await roundTwo('uf=ac&mu=1392&zn=9&se=228')
    expect(president.results?.candidates.map((entry) => entry.number).sort()).toEqual([13, 22])
  })

  it('refuses a race that round 2 does not hold, and offers no council', () => {
    expect(
      parseAddress(
        'secao',
        new URLSearchParams('uf=pe&mu=25313&zn=3&se=597&cargo=senador'),
        ROUND_TWO,
        2,
      ),
    ).toBeNull()
    expect(racesFor('pe', COUNCIL.municipality, ROUND_TWO, 2).map((race) => race.code)).toEqual([1])
  })
})
