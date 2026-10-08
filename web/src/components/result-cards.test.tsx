import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { OTHER, SENATE_SHADE, SHADES } from '@/lib/map-colors'
import type { CandidateRow, RaceResults } from '@/lib/results'
import { ResultCards } from './result-cards'

function results(candidates: [string, number, string][], choicesPerVoter = 1): RaceResults {
  const rows: CandidateRow[] = candidates.map(([name, votes, outcome], index) => ({
    number: 10 + index,
    name,
    party: 'P',
    votes,
    outcome,
  }))
  const valid = rows.reduce((sum, row) => sum + row.votes, 0)
  return {
    race: choicesPerVoter > 1 ? 5 : 3,
    seats: choicesPerVoter,
    choicesPerVoter,
    candidates: rows,
    candidatesUnderAppeal: [],
    parties: null,
    partiesUnderAppeal: [],
    otherUnderAppeal: 0,
    totals: {
      valid,
      blank: 0,
      null: 0,
      technicalNull: 0,
      annulled: 0,
      annulledUnderAppeal: 0,
      totalVotes: valid,
      attendance: valid,
      abstention: 0,
      eligible: valid,
    },
  }
}

function cards(html: string): string[] {
  return html.split('data-testid="result-card"').slice(1)
}

describe('ResultCards', () => {
  it('shows the Senate’s elected candidates and the next most voted', () => {
    const html = renderToStaticMarkup(
      <ResultCards
        locale="pt"
        results={results(
          [
            ['Ana Lima', 500, 'Eleito'],
            ['Bia Souza', 400, 'Eleito'],
            ['Caio Reis', 300, 'Não eleito'],
            ['Dora Melo', 100, 'Não eleito'],
          ],
          2,
        )}
        ranks={
          new Map([
            [10, 0],
            [11, 1],
          ])
        }
      />,
    )
    expect(cards(html)).toHaveLength(3)
    expect(html).toContain('Caio Reis')
    expect(html).not.toContain('Dora Melo')
  })

  it('names the candidate next to each color, and gives a third candidate the gray', () => {
    const html = renderToStaticMarkup(
      <ResultCards
        locale="pt"
        results={results([
          ['Ana Lima', 500, 'Eleito'],
          ['Bia Souza', 400, 'Eleito'],
          ['Caio Reis', 300, 'Não eleito'],
        ])}
        ranks={
          new Map([
            [10, 1],
            [11, 0],
          ])
        }
      />,
    )
    const [first, second, third] = cards(html)
    expect(first).toContain(`background:${SHADES[1][2]}`)
    expect(first).toContain('Ana Lima')
    expect(second).toContain(`background:${SHADES[0][2]}`)
    expect(second).toContain('Bia Souza')
    expect(third).toContain(`background:${OTHER}`)
    expect(third).toContain('Caio Reis')
  })

  it('marks Senate candidates in the Senate map\u2019s single shade', () => {
    const html = renderToStaticMarkup(
      <ResultCards
        locale="pt"
        results={results(
          [
            ['Ana Lima', 500, 'Eleito'],
            ['Bia Souza', 400, 'Eleito'],
            ['Caio Reis', 300, 'Não eleito'],
          ],
          2,
        )}
        ranks={
          new Map([
            [10, 0],
            [11, 1],
          ])
        }
      />,
    )
    const [first, second] = cards(html)
    expect(first).toContain(`background:${SENATE_SHADE[0]}`)
    expect(second).toContain(`background:${SENATE_SHADE[1]}`)
  })

  it('states the runoff’s date on a runoff card, in each language', () => {
    const race = results([
      ['Ana Lima', 500, '2º turno'],
      ['Bia Souza', 400, '2º turno'],
    ])
    const ranks = new Map<number, 0 | 1>([
      [10, 0],
      [11, 1],
    ])
    const pt = renderToStaticMarkup(<ResultCards locale="pt" results={race} ranks={ranks} />)
    const en = renderToStaticMarkup(<ResultCards locale="en" results={race} ranks={ranks} />)
    expect(cards(pt)[0]).toContain('2º turno em 25 de outubro de 2026')
    expect(cards(en)[1]).toContain('Runoff on October 25, 2026')
  })
})
