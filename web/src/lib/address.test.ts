import { describe, expect, it } from 'vitest'
import { addressQuery, parseAddress, racesFor } from './address'
import { raceBySlug } from './elections'

const AREA_RACES: Record<string, number[]> = {
  pe: [1, 3, 5, 6, 7],
  df: [1, 3, 5, 6, 8],
  zz: [1],
}

function parse(level: 'municipio' | 'zona' | 'secao', query: string) {
  return parseAddress(level, new URLSearchParams(query), AREA_RACES)
}

describe('parseAddress', () => {
  it('reads a station address', () => {
    expect(parse('secao', 'uf=pe&mu=25313&zn=3&se=597&cargo=governador')).toMatchObject({
      area: 'pe',
      municipality: 25313,
      zone: 3,
      station: 597,
      race: { code: 3 },
    })
  })

  it('takes President when the address names no race', () => {
    expect(parse('municipio', 'uf=zz&mu=29173')?.race.code).toBe(1)
  })

  it.each([
    ['SQL text in the municipality', 'uf=pe&mu=25313;DROP TABLE x&cargo=presidente'],
    ['a quoted municipality', "uf=pe&mu='25313'"],
    ['a slash in the state code', 'uf=pe/../sp&mu=25313'],
    ['a dot-dot state code', 'uf=..&mu=25313'],
    ['an upper-case state code', 'uf=PE&mu=25313'],
    ['an unknown state code', 'uf=xx&mu=25313'],
    ['a municipality of zero', 'uf=pe&mu=0'],
    ['a municipality out of range', 'uf=pe&mu=100000'],
    ['a negative municipality', 'uf=pe&mu=-1'],
    ['a fractional municipality', 'uf=pe&mu=1.5'],
    ['a repeated parameter', 'uf=pe&uf=sp&mu=25313'],
    ['an unknown race', 'uf=pe&mu=25313&cargo=prefeito'],
    ['a race the state does not have', 'uf=df&mu=97012&cargo=deputado-estadual'],
    ['a state race abroad', 'uf=zz&mu=29173&cargo=governador'],
    ['the council outside Fernando de Noronha', 'uf=pe&mu=25313&cargo=conselheiro-distrital'],
    ['a zone at the municipality level', 'uf=pe&mu=25313&zn=3'],
  ])('refuses %s', (_, query) => {
    expect(parse('municipio', query)).toBeNull()
  })

  it.each([
    ['a zone out of range', 'uf=pe&mu=25313&zn=10000&se=1'],
    ['a missing station', 'uf=pe&mu=25313&zn=3'],
    ['a station of zero', 'uf=pe&mu=25313&zn=3&se=0'],
    ['a station with a path', 'uf=pe&mu=25313&zn=3&se=1%2F..'],
  ])('refuses %s at the station level', (_, query) => {
    expect(parse('secao', query)).toBeNull()
  })

  it('offers the council in Fernando de Noronha only', () => {
    expect(racesFor('pe', 30015, AREA_RACES).map((race) => race.code)).toEqual([1, 3, 5, 6, 7, 25])
    expect(parse('municipio', 'uf=pe&mu=30015&cargo=conselheiro-distrital')?.race.code).toBe(25)
  })
})

describe('addressQuery', () => {
  it('writes an address that reads back the same', () => {
    const race = raceBySlug('senador')
    if (race === undefined) throw new Error('no senate race')
    const query = addressQuery({ area: 'pe', municipality: 25313, zone: 3, station: 597, race })
    expect(query).toBe('?uf=pe&mu=25313&zn=3&se=597&cargo=senador')
    expect(parse('secao', query.slice(1))).toMatchObject({ station: 597, race: { code: 5 } })
  })
})
