import { expect, it } from 'vitest'
import { tseStationUrl } from './tse-link'

it('opens a station in the form checked against TSE on 2026-10-06', () => {
  expect(tseStationUrl(6257, 'ac', 1066, 4, 77)).toBe(
    'https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/dados-de-urna/boletim-de-urna?e=6257&uf=ac&mu=01066&zn=0004&se=0077',
  )
})
