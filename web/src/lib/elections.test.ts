import { describe, expect, it } from 'vitest'
import { electionCode, proportionalRaces, raceBySlug, type RaceInfo } from './elections'

describe('proportionalRaces', () => {
  it('offers the Federal District its federal and district deputy races, and no state deputy', () => {
    expect(proportionalRaces([1, 3, 5, 6, 8]).map((race) => race.slug)).toEqual([
      'deputado-federal',
      'deputado-distrital',
    ])
  })

  it('offers a state its federal and state deputy races', () => {
    expect(proportionalRaces([1, 3, 5, 6, 7]).map((race) => race.slug)).toEqual([
      'deputado-federal',
      'deputado-estadual',
    ])
  })
})

describe('electionCode', () => {
  const race = (slug: string) => raceBySlug(slug) as RaceInfo

  it('gives each round its own code for President and Governor', () => {
    expect(electionCode(race('presidente'), 1)).toBe(6257)
    expect(electionCode(race('presidente'), 2)).toBe(6258)
    expect(electionCode(race('governador'), 1)).toBe(6259)
    expect(electionCode(race('governador'), 2)).toBe(6260)
  })

  it('refuses a race that round 2 does not hold', () => {
    expect(electionCode(race('senador'), 1)).toBe(6259)
    expect(() => electionCode(race('senador'), 2)).toThrow(/no round 2/)
  })
})
