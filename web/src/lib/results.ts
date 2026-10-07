/** The summary files' shape, and the rows a results view shows. */
import { raceByCode } from './elections'

export const VALID = 'Válido'
export const VALID_LIST = 'Válido (legenda)'
export const UNDER_APPEAL = 'Anulado sub judice'

export interface SummaryCandidate {
  numero: number
  nome: string
  partido: string
  votos: number
  destino: string
  resultado: string
}

export interface SummaryParty {
  numero: number
  sigla: string
  votos_legenda: number
  votos_candidatos: number
  destino: string
}

export interface SummaryRace {
  eleicao: number
  cargo: number
  nome: string
  vagas: number
  escolhas_por_eleitor: number
  aptos: number
  comparecimento: number
  abstencoes: number
  validos: number
  nominais: number
  legenda: number
  brancos: number
  nulos: number
  nulos_tecnicos: number
  anulados: number
  anulados_sub_judice: number
  candidatos: SummaryCandidate[]
  partidos?: SummaryParty[]
}

export interface Summary {
  versao_esquema: number
  ano: number
  turno: number
  area: string
  corridas: SummaryRace[]
}

export interface CandidateRow {
  number: number
  name: string
  party: string
  votes: number
  outcome: string
}

export interface PartyRow {
  number: number
  party: string
  candidateVotes: number
  listVotes: number
  total: number
}

export interface RaceResults {
  race: number
  seats: number
  choicesPerVoter: number
  candidates: CandidateRow[]
  candidatesUnderAppeal: CandidateRow[]
  /** Null outside the proportional races. */
  parties: PartyRow[] | null
  partiesUnderAppeal: PartyRow[]
  /** Votes under appeal that no listed candidate or party list carries. */
  otherUnderAppeal: number
  totals: {
    valid: number
    blank: number
    null: number
    technicalNull: number
    annulled: number
    annulledUnderAppeal: number
    totalVotes: number
    attendance: number
    abstention: number
    eligible: number
  }
}

const byVotesThenNumber = (
  a: { votes: number; number: number },
  b: { votes: number; number: number },
) => b.votes - a.votes || a.number - b.number

function candidateRow(candidate: SummaryCandidate): CandidateRow {
  return {
    number: candidate.numero,
    name: candidate.nome,
    party: candidate.partido,
    votes: candidate.votos,
    outcome: candidate.resultado,
  }
}

/**
 * A party's total counts only its valid candidate votes and its valid list votes. The
 * summary's `votos_candidatos` also counts candidates whose votes are under appeal, so it is
 * not used here: with it, a party table would add up to more than the valid votes.
 */
export function raceResults(race: SummaryRace, proportional: boolean): RaceResults {
  const valid = race.candidatos.filter((candidate) => candidate.destino === VALID)
  const underAppeal = race.candidatos.filter((candidate) => candidate.destino === UNDER_APPEAL)

  let parties: PartyRow[] | null = null
  const partiesUnderAppeal: PartyRow[] = []
  if (proportional) {
    const validVotesByParty = new Map<string, number>()
    for (const candidate of valid) {
      const sum = validVotesByParty.get(candidate.partido) ?? 0
      validVotesByParty.set(candidate.partido, sum + candidate.votos)
    }
    parties = []
    for (const party of race.partidos ?? []) {
      const candidateVotes = validVotesByParty.get(party.sigla) ?? 0
      const listValid = party.destino === VALID_LIST
      if (!listValid) {
        partiesUnderAppeal.push({
          number: party.numero,
          party: party.sigla,
          candidateVotes: 0,
          listVotes: party.votos_legenda,
          total: party.votos_legenda,
        })
      }
      if (listValid || candidateVotes > 0) {
        const listVotes = listValid ? party.votos_legenda : 0
        parties.push({
          number: party.numero,
          party: party.sigla,
          candidateVotes,
          listVotes,
          total: candidateVotes + listVotes,
        })
      }
    }
    parties.sort((a, b) => b.total - a.total || a.number - b.number)
  }

  const totalVotes =
    race.validos +
    race.brancos +
    race.nulos +
    race.nulos_tecnicos +
    race.anulados +
    race.anulados_sub_judice

  const listedUnderAppeal =
    underAppeal.reduce((sum, candidate) => sum + candidate.votos, 0) +
    partiesUnderAppeal.reduce((sum, party) => sum + party.listVotes, 0)

  return {
    race: race.cargo,
    seats: race.vagas,
    choicesPerVoter: race.escolhas_por_eleitor,
    candidates: valid.map(candidateRow).sort(byVotesThenNumber),
    candidatesUnderAppeal: underAppeal.map(candidateRow).sort(byVotesThenNumber),
    parties,
    partiesUnderAppeal,
    otherUnderAppeal: Math.max(race.anulados_sub_judice - listedUnderAppeal, 0),
    totals: {
      valid: race.validos,
      blank: race.brancos,
      null: race.nulos,
      technicalNull: race.nulos_tecnicos,
      annulled: race.anulados,
      annulledUnderAppeal: race.anulados_sub_judice,
      totalVotes,
      attendance: race.comparecimento,
      abstention: race.abstencoes,
      eligible: race.aptos,
    },
  }
}

/** The outcomes that count as winning a seat or a place in the runoff. */
export function isElected(outcome: string): boolean {
  return outcome.startsWith('Eleito')
}

export function isInRunoff(outcome: string): boolean {
  return outcome === '2º turno'
}

/** The races a summary holds, as route slugs. An unknown race code fails the build. */
export function raceSlugsOf(summary: Summary): string[] {
  return summary.corridas.map((race) => {
    const info = raceByCode(race.cargo)
    if (info === undefined) throw new Error(`unknown race code ${race.cargo} in ${summary.area}`)
    return info.slug
  })
}
