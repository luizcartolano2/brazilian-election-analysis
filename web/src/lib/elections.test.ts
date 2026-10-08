import { describe, expect, it } from 'vitest'
import { proportionalRaces } from './elections'

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
