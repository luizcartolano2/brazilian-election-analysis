import { describe, expect, it } from 'vitest'
import { drilldownRoundHref } from './round-link'

const ROUND_TWO = { ac: [1, 3], pe: [1] }

describe('drilldownRoundHref', () => {
  const href = (query: string, races: Record<string, number[]> | null = ROUND_TWO) =>
    drilldownRoundHref('/2026/segundo-turno/secao/', new URLSearchParams(query), races)

  it('keeps the place and a race that the other round holds there', () => {
    expect(href('uf=ac&mu=1015&zn=2&se=87&cargo=governador')).toBe(
      '/2026/segundo-turno/secao/?uf=ac&mu=1015&zn=2&se=87&cargo=governador',
    )
  })

  it('drops a race that the other round does not hold there', () => {
    expect(href('uf=pe&mu=25313&zn=3&se=597&cargo=governador')).toBe(
      '/2026/segundo-turno/secao/?uf=pe&mu=25313&zn=3&se=597',
    )
    expect(href('uf=pe&mu=30015&cargo=conselheiro-distrital')).toBe(
      '/2026/segundo-turno/secao/?uf=pe&mu=30015',
    )
  })

  it('keeps no query for an area the round lacks, or a round with no data yet', () => {
    expect(href('uf=xx&mu=1')).toBe('/2026/segundo-turno/secao/')
    expect(href('uf=ac&mu=1015', null)).toBe('/2026/segundo-turno/secao/')
  })
})
