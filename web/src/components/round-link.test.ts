import { describe, expect, it } from 'vitest'
import { drilldownRoundHref } from './round-link'

const ROUND_TWO = { ac: [1, 3], pe: [1] }
const VIEW = '/2026/segundo-turno/secao/'
const BRAZIL = '/2026/segundo-turno/'

describe('drilldownRoundHref', () => {
  const href = (query: string, races: Record<string, number[]> | null = ROUND_TWO) =>
    drilldownRoundHref(VIEW, BRAZIL, new URLSearchParams(query), races)

  it('keeps the place and a race that the round holds there', () => {
    expect(href('uf=ac&mu=1015&zn=2&se=87&cargo=governador')).toBe(
      `${VIEW}?uf=ac&mu=1015&zn=2&se=87&cargo=governador`,
    )
  })

  it('drops a race that the round does not hold there', () => {
    expect(href('uf=pe&mu=25313&zn=3&se=597&cargo=governador')).toBe(
      `${VIEW}?uf=pe&mu=25313&zn=3&se=597`,
    )
    expect(href('uf=pe&mu=30015&cargo=conselheiro-distrital')).toBe(`${VIEW}?uf=pe&mu=30015`)
  })

  it('leads to the Brazil page for an area that the round lacks', () => {
    expect(href('uf=rj&mu=60011')).toBe(BRAZIL)
  })

  it('keeps no query for a round with no data yet, or an address with no area', () => {
    expect(href('uf=ac&mu=1015', null)).toBe(VIEW)
    expect(href('')).toBe(VIEW)
  })
})
