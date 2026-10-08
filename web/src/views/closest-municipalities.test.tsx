import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { raceByCode, type RaceInfo } from '@/lib/elections'
import type { MapData, MapRow } from '@/lib/maps'
import { ClosestList } from './closest-municipalities'

const GOVERNOR = raceByCode(3) as RaceInfo

function row(municipio: number, nome: string, first: number, second: number): MapRow {
  return [municipio, municipio, nome, 0, first, 1, second, first + second]
}

describe('ClosestList', () => {
  const data: MapData = {
    kind: 'margin',
    units: ['Raquel Lyra (PSD)', 'João Campos (PSB)'],
    rows: [row(1, 'Recife', 60, 40), row(2, 'Tamandaré', 50, 50)],
  }

  it('shows a tie as a tie with a margin of zero, and names both candidates', () => {
    const html = renderToStaticMarkup(
      <ClosestList locale="pt" area="pe" race={GOVERNOR} data={data} />,
    )
    const [tie, close] = html.split('<li').slice(1)
    expect(tie).toContain('Tamandaré')
    expect(tie).toContain('Empate · 0,0 p.p.')
    expect(tie).toContain('Raquel Lyra (PSD) e João Campos (PSB)')
    expect(close).toContain('20,0 p.p.')
    expect(close).not.toContain('Empate')
  })

  it('links each municipality to its view on the race', () => {
    const html = renderToStaticMarkup(
      <ClosestList locale="pt" area="pe" race={GOVERNOR} data={data} />,
    )
    // Outside a Next build, the link drops the trailing slash that the export adds.
    expect(html).toMatch(/href="\/2026\/municipio\/?\?uf=pe&amp;mu=2&amp;cargo=governador"/)
  })
})
