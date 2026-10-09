import { expect, it } from 'vitest'
import { parseAddress } from './address'
import { stationLinkOf, tseStationUrl } from './tse-link'

it('opens a station in the form checked against TSE on 2026-10-06', () => {
  expect(tseStationUrl(6257, 'ac', 1066, 4, 77)).toBe(
    'https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/dados-de-urna/boletim-de-urna?e=6257&uf=ac&mu=01066&zn=0004&se=0077',
  )
})

it('links a station view under the election code of its round and race', () => {
  const link = (query: string, round: 1 | 2) => {
    const address = parseAddress('secao', new URLSearchParams(query), { ac: [1, 3] }, round)
    if (address === null) throw new Error(`invalid address ${query}`)
    return stationLinkOf(address)
  }
  expect(link('uf=ac&mu=1392&zn=9&se=228', 1)).toContain('?e=6257&uf=ac&mu=01392&zn=0009&se=0228')
  expect(link('uf=ac&mu=1392&zn=9&se=228', 2)).toContain('?e=6258&uf=ac')
  expect(link('uf=ac&mu=1392&zn=9&se=228&cargo=governador', 2)).toContain('?e=6260&uf=ac')
})

it('gives a municipality view no station link', () => {
  const address = parseAddress('municipio', new URLSearchParams('uf=ac&mu=1392'), { ac: [1] }, 2)
  expect(address && stationLinkOf(address)).toBeNull()
})
