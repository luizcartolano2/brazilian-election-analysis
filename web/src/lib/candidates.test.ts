import { describe, expect, it } from 'vitest'
import { placeOf, sharesByState } from './candidates'
import { formatOrdinal } from './format'
import { candidateHeadline, candidateHeadlineText } from './headline'
import type { RaceResults, SummaryCandidate } from './results'

function results(votes: [number, number][]): RaceResults {
  const valid = votes.reduce((sum, [, count]) => sum + count, 0)
  return {
    race: 1,
    seats: 1,
    choicesPerVoter: 1,
    candidates: votes.map(([number, count]) => ({
      number,
      name: `C${number}`,
      party: 'P',
      votes: count,
      outcome: '',
    })),
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

function candidate(resultado: string, destino = 'Válido'): SummaryCandidate {
  return { numero: 13, nome: 'Ana Lima', partido: 'P', votos: 10, destino, resultado }
}

describe('placeOf', () => {
  it('counts a candidate’s place among the valid candidates', () => {
    const race = results([
      [22, 500],
      [13, 400],
      [30, 100],
    ])
    expect(placeOf(race, 30)).toBe(3)
    expect(placeOf(race, 99)).toBeNull()
  })
})

describe('sharesByState', () => {
  it('orders the states from the highest share, and marks where the candidate led', () => {
    const shares = sharesByState(
      [
        {
          area: 'sp',
          results: results([
            [22, 60],
            [13, 40],
          ]),
        },
        {
          area: 'pe',
          results: results([
            [13, 70],
            [22, 30],
          ]),
        },
        {
          area: 'ba',
          results: results([
            [13, 55],
            [22, 45],
          ]),
        },
      ],
      13,
    )
    expect(shares.map((share) => share.area)).toEqual(['pe', 'ba', 'sp'])
    expect(shares.filter((share) => share.led).map((share) => share.area)).toEqual(['pe', 'ba'])
  })
})

describe('formatOrdinal', () => {
  it.each([
    [1, '1º', '1st'],
    [2, '2º', '2nd'],
    [3, '3º', '3rd'],
    [11, '11º', '11th'],
    [22, '22º', '22nd'],
  ])('writes place %i in each language', (place, pt, en) => {
    expect(formatOrdinal('pt', place)).toBe(pt)
    expect(formatOrdinal('en', place)).toBe(en)
  })
})

describe('candidateHeadline', () => {
  it('states a runoff, with its date', () => {
    expect(candidateHeadlineText('pt', candidateHeadline(candidate('2º turno'), 2, 1))).toBe(
      'Vai ao 2º turno, em 25 de outubro de 2026',
    )
  })

  it('states an election, and the Senate’s without a round', () => {
    expect(candidateHeadlineText('pt', candidateHeadline(candidate('Eleito'), 1, 3))).toBe(
      'Vence no 1º turno',
    )
    expect(candidateHeadlineText('en', candidateHeadline(candidate('Eleito'), 1, 5))).toBe(
      'Wins a Senate seat',
    )
  })

  it('states the place of a candidate with neither outcome', () => {
    expect(candidateHeadlineText('pt', candidateHeadline(candidate('Não eleito'), 3, 3))).toBe(
      'Termina em 3º lugar',
    )
    expect(candidateHeadlineText('en', candidateHeadline(candidate('Não eleito'), 3, 3))).toBe(
      'Finishes in 3rd place',
    )
  })

  it('states TSE’s status for votes under appeal, and no place', () => {
    const headline = candidateHeadline(candidate('', 'Anulado sub judice'), null, 5)
    expect(headline).toEqual({ form: 'status', status: 'Anulado sub judice' })
    expect(candidateHeadlineText('pt', headline)).toBe('Votos sob recurso: Anulado sub judice')
  })
})
