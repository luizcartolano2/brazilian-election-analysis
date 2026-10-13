import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { SwingData, SwingRow } from '@/lib/maps'
import { MunicipalityTable, SwingText, type MapLabels, type SwingLabels } from './race-map'

const LABELS = {
  table: {
    caption: 'Lula: parcela nos votos dos dois finalistas em cada turno',
    municipality: 'Município',
    filter: 'Filtrar municípios',
    sortName: 'Por nome',
    count: '{shown} de {total} municípios',
  },
  swing: {
    firstShare: '1º turno: {share}',
    secondShare: '2º turno: {share}',
    change: 'Variação: {points} p.p.',
    noSwing: [
      'Sem votos para os finalistas no 1º turno',
      'Sem votos para os finalistas no 2º turno',
    ],
    noSwingLegend: 'Sem votos para os finalistas em um dos turnos',
    headFirst: '1º turno, dos votos dos dois finalistas',
    headSecond: '2º turno, dos votos dos dois finalistas',
    headChange: 'Variação, em p.p.',
    sortSwing: 'Pela variação',
  },
} as unknown as MapLabels

const DATA: SwingData = {
  kind: 'swing',
  units: ['Lula'],
  rows: [
    [2611606, 25313, 'Recife', 600, 300, 620, 330],
    [1100015, 310, 'Alta Floresta', 0, 0, 5, 3],
    [2609600, 24570, 'Olinda', 100, 100, 330, 270],
  ],
}

function render(): string {
  return renderToStaticMarkup(
    <MunicipalityTable
      locale="pt"
      data={DATA}
      labels={LABELS}
      hrefOf={(row) => `/2026/segundo-turno/municipio/?mu=${row[1]}`}
      hydrated={false}
      byState={false}
    />,
  )
}

describe('the swing list', () => {
  it('heads each share with the two finalists’ votes', () => {
    const markup = render()
    expect(markup).toContain('<th scope="col" class="py-1 pr-2 font-medium">Município</th>')
    expect(markup).toContain('1º turno, dos votos dos dois finalistas')
    expect(markup).toContain('2º turno, dos votos dos dois finalistas')
    expect(markup).toContain('Variação, em p.p.')
  })

  it('shows each round’s share and the signed swing', () => {
    const markup = render()
    expect(markup).toMatch(/Recife<\/a><\/td><td>66,67%<\/td><td>65,26%<\/td><td>−1,4<\/td>/)
    expect(markup).toMatch(/Olinda<\/a><\/td><td>50,00%<\/td><td>55,00%<\/td><td>\+5,0<\/td>/)
  })

  it('says in which round the finalists had no votes', () => {
    expect(render()).toMatch(
      /Alta Floresta<\/a><\/td><td>–<\/td><td>62,50%<\/td><td>Sem votos para os finalistas no 1º turno<\/td>/,
    )
  })
})

describe('a swing map’s details', () => {
  const details = (row: SwingRow) =>
    renderToStaticMarkup(<SwingText locale="pt" labels={LABELS.swing as SwingLabels} row={row} />)

  it('show both rounds’ shares and the signed swing', () => {
    expect(details([2611606, 25313, 'Recife', 600, 300, 620, 330])).toBe(
      '<strong class="block">Recife</strong><span class="block">1º turno: 66,67%</span>' +
        '<span class="block">2º turno: 65,26%</span><span class="block">Variação: −1,4 p.p.</span>',
    )
  })

  it('show both rounds’ shares and say in which round the finalists had no votes', () => {
    expect(details([1100015, 310, 'Alta Floresta', 0, 0, 5, 3])).toBe(
      '<strong class="block">Alta Floresta</strong><span class="block">1º turno: –</span>' +
        '<span class="block">2º turno: 62,50%</span>' +
        '<span class="block">Sem votos para os finalistas no 1º turno</span>',
    )
  })
})

describe('the swing list’s order', () => {
  it('lists the municipalities by name before a visitor sorts', () => {
    const names = [...render().matchAll(/<a href="[^"]+">([^<]+)<\/a>/g)].map((match) => match[1])
    expect(names).toEqual(['Alta Floresta', 'Olinda', 'Recife'])
  })
})
