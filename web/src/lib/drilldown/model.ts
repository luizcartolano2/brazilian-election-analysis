import type { RaceInfo } from '../elections'
import {
  SummaryMismatch,
  UNDER_APPEAL,
  VALID,
  VALID_LIST,
  type SummaryCandidate,
  type SummaryParty,
  type SummaryRace,
} from '../results'

/** One row of a vote file: what was typed, how TSE counted it, and how many times. */
export interface VoteRow {
  tipo: number
  numero: number
  votos: number
}

export interface CandidateInfo {
  numero: number
  nome_urna: string
  partido_numero: number | null
  partido_sigla: string | null
  resultado: string | null
}

export interface Turnout {
  aptos: number
  comparecimento: number
  abstencoes: number
}

export interface RaceShape {
  seats: number
  choicesPerVoter: number
}

const TYPE = {
  candidate: 1,
  list: 2,
  blank: 3,
  null: 4,
  technicalNull: 5,
  annulled: 6,
  underAppeal: 7,
}

/**
 * Builds a summary-shaped race from Parquet rows, so a municipality, a zone or a station
 * passes through the same checks and tables as a state.
 */
export function raceFromRows(
  race: RaceInfo,
  shape: RaceShape,
  rows: VoteRow[],
  candidates: CandidateInfo[],
  turnout: Turnout,
): SummaryRace {
  const info = new Map(candidates.map((candidate) => [candidate.numero, candidate]))
  const partyName = new Map<number, string>()
  for (const candidate of candidates) {
    if (candidate.partido_numero !== null && candidate.partido_sigla) {
      partyName.set(candidate.partido_numero, candidate.partido_sigla)
    }
  }
  const sigla = (number: number) => partyName.get(number) ?? String(number)
  // A deputy's number starts with the party's two digits, which covers a candidate the
  // registry file does not list.
  const partyOf = (number: number): number | null =>
    info.get(number)?.partido_numero ??
    (race.proportional ? Number(String(number).slice(0, 2)) : null)

  const totals = { blank: 0, null: 0, technicalNull: 0, annulled: 0, underAppeal: 0 }
  const candidatos: SummaryCandidate[] = []
  const lists = new Map<number, SummaryParty>()
  const listOf = (number: number) => {
    let party = lists.get(number)
    if (party === undefined) {
      party = {
        numero: number,
        sigla: sigla(number),
        votos_legenda: 0,
        votos_candidatos: 0,
        destino: VALID_LIST,
      }
      lists.set(number, party)
    }
    return party
  }
  const candidate = (row: VoteRow, destino: string): SummaryCandidate => {
    const known = info.get(row.numero)
    return {
      numero: row.numero,
      nome: known?.nome_urna ?? String(row.numero),
      partido: partyOf(row.numero) === null ? '' : sigla(partyOf(row.numero) as number),
      votos: row.votos,
      destino,
      resultado: known?.resultado ?? '',
    }
  }

  for (const row of rows) {
    switch (row.tipo) {
      case TYPE.candidate:
        candidatos.push(candidate(row, VALID))
        break
      case TYPE.list:
        listOf(row.numero).votos_legenda += row.votos
        break
      case TYPE.blank:
        totals.blank += row.votos
        break
      case TYPE.null:
        totals.null += row.votos
        break
      case TYPE.technicalNull:
        totals.technicalNull += row.votos
        break
      case TYPE.annulled:
        totals.annulled += row.votos
        break
      case TYPE.underAppeal:
        totals.underAppeal += row.votos
        // In a deputy race, a two-digit number is a party list.
        if (race.proportional && row.numero < 100) {
          const party = listOf(row.numero)
          party.votos_legenda += row.votos
          party.destino = UNDER_APPEAL
        } else {
          candidatos.push(candidate(row, UNDER_APPEAL))
        }
        break
      default:
        throw new SummaryMismatch(`race ${race.code}: unknown vote type ${row.tipo}`)
    }
  }

  if (race.proportional) {
    for (const entry of candidatos) {
      const number = partyOf(entry.numero)
      if (entry.destino === VALID && number !== null) listOf(number)
    }
  }

  const nominal = candidatos
    .filter((entry) => entry.destino === VALID)
    .reduce((sum, entry) => sum + entry.votos, 0)
  const list = [...lists.values()]
    .filter((party) => party.destino === VALID_LIST)
    .reduce((sum, party) => sum + party.votos_legenda, 0)

  return {
    eleicao: race.election,
    cargo: race.code,
    nome: race.pt,
    vagas: shape.seats,
    escolhas_por_eleitor: shape.choicesPerVoter,
    aptos: turnout.aptos,
    comparecimento: turnout.comparecimento,
    abstencoes: turnout.abstencoes,
    validos: nominal + list,
    nominais: nominal,
    legenda: list,
    brancos: totals.blank,
    nulos: totals.null,
    nulos_tecnicos: totals.technicalNull,
    anulados: totals.annulled,
    anulados_sub_judice: totals.underAppeal,
    candidatos,
    partidos: race.proportional ? [...lists.values()] : [],
  }
}
