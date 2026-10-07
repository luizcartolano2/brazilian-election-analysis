import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { raceByCode } from './elections'
import { raceResults, raceSlugsOf, type Summary, type SummaryRace } from './results'

function fixture(area: string): Summary {
  const file = path.join(
    import.meta.dirname,
    '..',
    '..',
    'fixtures',
    '2026',
    't1',
    'resumo',
    `${area}.json`,
  )
  return JSON.parse(readFileSync(file, 'utf-8')) as Summary
}

function race(summary: Summary, code: number): SummaryRace {
  const found = summary.corridas.find((entry) => entry.cargo === code)
  if (found === undefined) throw new Error(`no race ${code} in ${summary.area}`)
  return found
}

function results(summary: Summary, code: number) {
  return raceResults(race(summary, code), raceByCode(code)?.proportional ?? false)
}

describe('raceResults', () => {
  it('orders valid candidates by votes', () => {
    const votes = results(fixture('pe'), 3).candidates.map((candidate) => candidate.votes)
    expect(votes).toEqual([...votes].sort((a, b) => b - a))
  })

  it('makes candidate and list votes in a deputy race add up to the valid votes', () => {
    for (const area of ['ac', 'pe', 'se']) {
      for (const code of [6, 7]) {
        const deputy = results(fixture(area), code)
        const parties = deputy.parties ?? []
        const sum = parties.reduce((total, party) => total + party.total, 0)
        expect(sum, `${area} race ${code}`).toBe(deputy.totals.valid)
      }
    }
  })

  it('keeps votes under appeal apart from valid votes, and accounts for all of them', () => {
    const senate = results(fixture('pe'), 5)
    expect(senate.candidatesUnderAppeal.map((candidate) => candidate.number)).toEqual([355])
    expect(senate.candidates.some((candidate) => candidate.number === 355)).toBe(false)
    for (const code of [5, 6, 7]) {
      const entry = results(fixture('pe'), code)
      const listed =
        entry.candidatesUnderAppeal.reduce((sum, candidate) => sum + candidate.votes, 0) +
        entry.partiesUnderAppeal.reduce((sum, party) => sum + party.listVotes, 0) +
        entry.otherUnderAppeal
      expect(listed, `race ${code}`).toBe(entry.totals.annulledUnderAppeal)
    }
  })

  it('shows a whole party list under appeal on its own line', () => {
    const state = results(fixture('pe'), 7)
    expect(state.partiesUnderAppeal.map((party) => party.number)).toEqual([33])
    expect(state.parties?.some((party) => party.number === 33)).toBe(false)
  })

  it('has no party table outside the proportional races', () => {
    expect(results(fixture('pe'), 1).parties).toBeNull()
  })

  it('records two choices per voter in the Senate race', () => {
    expect(results(fixture('pe'), 5).choicesPerVoter).toBe(2)
  })

  it('marks the runoff candidates as TSE lists them', () => {
    const president = results(fixture('br'), 1)
    const runoff = president.candidates.filter((candidate) => candidate.outcome === '2º turno')
    expect(runoff).toHaveLength(2)
    expect(runoff.map((candidate) => candidate.votes)).toEqual(
      president.candidates.slice(0, 2).map((candidate) => candidate.votes),
    )
  })
})

describe('race lists', () => {
  it('offers the district deputy race, not a state deputy race, in the Federal District', () => {
    const base = race(fixture('pe'), 7)
    const federalDistrict: Summary = {
      ...fixture('pe'),
      area: 'DF',
      corridas: [race(fixture('pe'), 1), { ...base, cargo: 8, nome: 'Deputado Distrital' }],
    }
    expect(raceSlugsOf(federalDistrict)).toEqual(['presidente', 'deputado-distrital'])
  })
})
