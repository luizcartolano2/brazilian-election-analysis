import { describe, expect, it } from 'vitest'
import { headlineText, raceHeadline } from './headline'
import type { CandidateRow, RaceResults } from './results'

function results(candidates: [string, string][], seats = 1, race = 3): RaceResults {
  const rows: CandidateRow[] = candidates.map(([name, outcome], index) => ({
    number: 10 + index,
    name,
    party: 'P',
    votes: 1000 - index,
    outcome,
  }))
  return {
    race,
    seats,
    choicesPerVoter: 1,
    candidates: rows,
    candidatesUnderAppeal: [],
    parties: null,
    partiesUnderAppeal: [],
    otherUnderAppeal: 0,
    totals: {
      valid: 0,
      blank: 0,
      null: 0,
      technicalNull: 0,
      annulled: 0,
      annulledUnderAppeal: 0,
      totalVotes: 0,
      attendance: 0,
      abstention: 0,
      eligible: 0,
    },
  }
}

describe('raceHeadline', () => {
  it('names both candidates in the runoff', () => {
    const headline = raceHeadline(
      results([
        ['Flavio Bolsonaro', '2º turno'],
        ['Lula', '2º turno'],
        ['Zema', 'Não eleito'],
      ]),
      false,
    )
    expect(headline).toEqual({ form: 'runoff', names: ['Flavio Bolsonaro', 'Lula'] })
    expect(headlineText('pt', headline!, 'Presidente')).toBe(
      'Flavio Bolsonaro e Lula vão ao 2º turno',
    )
    expect(headlineText('en', headline!, 'President')).toBe(
      'Flavio Bolsonaro and Lula go to the runoff',
    )
  })

  it('names a Governor elected in the first round', () => {
    const headline = raceHeadline(
      results([
        ['Raquel Lyra', 'Eleito'],
        ['João Campos', 'Não eleito'],
      ]),
      false,
    )
    expect(headlineText('pt', headline!, 'Governador')).toBe('Raquel Lyra vence no 1º turno')
  })

  it('names both Senate winners with a plural verb', () => {
    const headline = raceHeadline(
      results(
        [
          ['Humberto Costa', 'Eleito'],
          ['Marília Arraes', 'Eleito'],
          ['Mendonça Filho', 'Não eleito'],
        ],
        2,
        5,
      ),
      false,
    )
    expect(headlineText('pt', headline!, 'Senador')).toBe(
      'Humberto Costa e Marília Arraes vencem para o Senado',
    )
    expect(headlineText('en', headline!, 'Senator')).toBe(
      'Humberto Costa and Marília Arraes win the Senate seats',
    )
  })

  it('calls no one elected in a race with no elected or runoff outcome', () => {
    const headline = raceHeadline(
      results([
        ['Ana Lima', ''],
        ['Bia Souza', ''],
      ]),
      false,
    )
    expect(headline).toEqual({ form: 'mostVoted', name: 'Ana Lima' })
    expect(headlineText('pt', headline!, 'Governador')).toBe('Ana Lima teve mais votos')
  })

  it('counts a deputy race’s elected, "Eleito por QP" included, before any other form', () => {
    const headline = raceHeadline(
      results(
        [
          ['Ana Lima', 'Eleito por QP'],
          ['Bia Souza', 'Eleito por média'],
          ['Caio Reis', 'Suplente'],
        ],
        25,
      ),
      true,
    )
    expect(headline).toEqual({ form: 'count', count: 2 })
    expect(headlineText('pt', headline!, 'Deputado federal')).toBe(
      'Deputado federal: 2 vagas preenchidas',
    )
  })

  it('states a deputy race’s seats, with no count, when TSE elected no one', () => {
    const headline = raceHeadline(
      results(
        [
          ['Ana Lima', ''],
          ['Bia Souza', ''],
        ],
        25,
      ),
      true,
    )
    expect(headline).toEqual({ form: 'seats', seats: 25 })
    expect(headlineText('en', headline!, 'Federal deputy')).toBe('Federal deputy: 25 seats')
  })

  it('has no headline for a race with no candidates', () => {
    expect(raceHeadline(results([]), false)).toBeNull()
  })
})
