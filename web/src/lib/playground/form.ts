/**
 * The form's queries: fixed text, filled only with whole numbers and with codes from fixed
 * lists, so nothing that a visitor types reaches them.
 */
import { AREAS } from '../elections'
import type { DataChoice } from './choice'

export type Question = 'each' | 'one' | 'turnout' | 'blankNull'
export type PlaceLevel = 'uf' | 'municipio' | 'zona' | 'secao'
export type Order = 'desc' | 'asc' | 'place'

export const QUESTIONS: readonly Question[] = ['each', 'one', 'turnout', 'blankNull']
export const PLACE_LEVELS: readonly PlaceLevel[] = ['uf', 'municipio', 'zona', 'secao']
export const ORDERS: readonly Order[] = ['desc', 'asc', 'place']
export const ROW_COUNTS = [10, 100, 1000, null] as const
export type RowCount = (typeof ROW_COUNTS)[number]

export interface Candidate {
  /** The area of the candidate's list: `br` for the President. */
  area: string
  numero: number
}

export interface FormState {
  question: Question
  level: PlaceLevel
  race: number
  candidate: Candidate | null
  order: Order
  rows: RowCount
}

const AREA_CODES = new Set(AREAS.map((area) => area.code))

function wholeNumber(value: number): number {
  if (!Number.isInteger(value)) throw new Error(`${value} is not a whole number`)
  return value
}

/** A state code in capitals, only from the fixed list of areas. */
function stateCode(area: string): string {
  if (!AREA_CODES.has(area)) throw new Error(`${area} is not an area`)
  return `'${area.toUpperCase()}'`
}

/**
 * A share in percent with two decimals, rounded half up in whole numbers, as the results
 * pages print it. Floating point rounds a share that ends in five down now and then.
 */
export function shareSql(part: string, whole: string): string {
  return (
    `CASE WHEN ${whole} = 0 THEN NULL ` +
    `ELSE ((${part})::BIGINT * 20000 + ${whole}) // (2 * ${whole}) / 100 END`
  )
}

const LEVEL_KEYS: Record<PlaceLevel, string[]> = {
  uf: ['turno', 'uf'],
  municipio: ['turno', 'uf', 'municipio'],
  zona: ['turno', 'uf', 'municipio', 'zona'],
  secao: ['turno', 'uf', 'municipio', 'zona', 'secao'],
}

const VOTES_TABLE: Record<PlaceLevel, string> = {
  uf: 'votos_municipio',
  municipio: 'votos_municipio',
  zona: 'votos_zona',
  secao: 'votos_secao',
}

const TURNOUT_TABLE: Record<PlaceLevel, string> = {
  uf: 'comparecimento_municipio',
  municipio: 'comparecimento_municipio',
  zona: 'comparecimento_zona',
  secao: 'comparecimento_secao',
}

/** The place's columns, grouping and order: by code, state and round, never by name. */
function place(level: PlaceLevel, alias: string, bothRounds: boolean) {
  const keys = LEVEL_KEYS[level]
  const named = level !== 'uf'
  const columns = [
    ...(bothRounds ? [`${alias}.turno`] : []),
    `${alias}.uf`,
    ...(named ? ['m.nome AS municipio'] : []),
    ...(level === 'zona' || level === 'secao' ? [`${alias}.zona`] : []),
    ...(level === 'secao' ? [`${alias}.secao`] : []),
  ]
  const group = [...keys.map((key) => `${alias}.${key}`), ...(named ? ['m.nome'] : [])]
  const order = [
    ...(bothRounds ? [`${alias}.turno`] : []),
    `${alias}.uf`,
    ...(named ? ['m.nome', `${alias}.municipio`] : []),
    ...(level === 'zona' || level === 'secao' ? [`${alias}.zona`] : []),
    ...(level === 'secao' ? [`${alias}.secao`] : []),
  ]
  const join = named ? `JOIN municipios m ON m.municipio = ${alias}.municipio` : null
  return { keys, columns, group, order, join }
}

function orderBy(state: FormState, measure: string, placeOrder: string[]): string {
  if (state.order === 'place') return placeOrder.join(', ')
  const direction = state.order === 'desc' ? 'DESC' : 'ASC'
  return [`${measure} ${direction} NULLS LAST`, ...placeOrder].join(', ')
}

function lines(parts: (string | null)[]): string {
  return parts.filter((part): part is string => part !== null).join('\n')
}

function limit(rows: RowCount): string | null {
  return rows === null ? null : `LIMIT ${wholeNumber(rows)}`
}

function validVotes(table: string, keys: string[], race: number): string {
  return lines([
    'WITH validos AS (',
    `  SELECT ${keys.join(', ')}, sum(votos) AS validos`,
    `  FROM ${table}`,
    `  WHERE cargo = ${race} AND tipo IN (1, 2)`,
    `  GROUP BY ${keys.join(', ')}`,
    ')',
  ])
}

/** The SQL that the form writes for its choices. */
export function formQuery(state: FormState, choice: DataChoice): string {
  const race = wholeNumber(state.race)
  if (!choice.races.includes(race)) throw new Error(`race ${race} is not in the data choice`)
  const bothRounds = choice.rounds.length > 1

  if (state.question === 'turnout') {
    const table = TURNOUT_TABLE[state.level]
    const at = place(state.level, 't', bothRounds)
    return lines([
      `SELECT ${at.columns.join(', ')},`,
      '       sum(t.aptos)::BIGINT AS aptos, sum(t.comparecimento)::BIGINT AS comparecimento,',
      '       sum(t.abstencoes)::BIGINT AS abstencoes,',
      `       ${shareSql('sum(t.comparecimento)', 'sum(t.aptos)')} AS percentual_comparecimento`,
      `FROM ${table} t`,
      at.join,
      `WHERE t.cargo = ${race}`,
      `GROUP BY ${at.group.join(', ')}`,
      `ORDER BY ${orderBy(state, 'percentual_comparecimento', at.order)}`,
      limit(state.rows),
    ])
  }

  const table = VOTES_TABLE[state.level]
  const at = place(state.level, 'v', bothRounds)

  if (state.question === 'blankNull') {
    const count = (types: string) =>
      `coalesce(sum(v.votos) FILTER (WHERE v.tipo IN (${types})), 0)::BIGINT`
    const kinds: [string, string][] = [
      ['brancos', '3'],
      ['nulos', '4'],
      ['nulos_tecnicos', '5'],
      ['anulados', '6'],
    ]
    return lines([
      `SELECT ${at.columns.join(', ')},`,
      '       sum(v.votos)::BIGINT AS votos,',
      kinds
        .map(
          ([name, types]) =>
            `       ${count(types)} AS ${name},\n` +
            `       ${shareSql(count(types), 'sum(v.votos)')} AS percentual_${name}`,
        )
        .join(',\n'),
      `FROM ${table} v`,
      at.join,
      `WHERE v.cargo = ${race}`,
      `GROUP BY ${at.group.join(', ')}`,
      `ORDER BY ${orderBy(state, 'percentual_brancos + percentual_nulos', at.order)}`,
      limit(state.rows),
    ])
  }

  const shareColumn = `${shareSql('sum(v.votos)', 'd.validos')} AS percentual_validos`
  if (state.question === 'one') {
    const candidate = state.candidate
    if (candidate === null) throw new Error('the question needs a candidate')
    const numero = wholeNumber(candidate.numero)
    const area = candidate.area === 'br' ? null : `v.uf = ${stateCode(candidate.area)}`
    return lines([
      validVotes(table, at.keys, race),
      `SELECT ${at.columns.join(', ')},`,
      '       sum(v.votos)::BIGINT AS votos,',
      `       ${shareColumn}`,
      `FROM ${table} v`,
      `JOIN validos d USING (${at.keys.join(', ')})`,
      at.join,
      `WHERE v.cargo = ${race} AND v.tipo = 1 AND v.numero = ${numero}` +
        (area === null ? '' : ` AND ${area}`),
      `GROUP BY ${at.group.join(', ')}, d.validos`,
      `ORDER BY ${orderBy(state, 'votos', at.order)}`,
      limit(state.rows),
    ])
  }

  // The pipeline writes the President's candidates once, under BR.
  return lines([
    validVotes(table, at.keys, race),
    `SELECT ${at.columns.join(', ')},`,
    '       v.numero, c.nome_urna AS candidato, c.partido_sigla AS partido,',
    '       sum(v.votos)::BIGINT AS votos,',
    `       ${shareColumn}`,
    `FROM ${table} v`,
    `JOIN validos d USING (${at.keys.join(', ')})`,
    'JOIN candidatos c ON c.turno = v.turno AND c.cargo = v.cargo AND c.numero = v.numero',
    "  AND c.uf = CASE WHEN v.cargo = 1 THEN 'BR' ELSE v.uf END AND c.destino = 'Válido'",
    at.join,
    `WHERE v.cargo = ${race} AND v.tipo = 1`,
    `GROUP BY ${at.group.join(', ')}, v.numero, c.nome_urna, c.partido_sigla, d.validos`,
    `ORDER BY ${orderBy(state, 'votos', state.order === 'place' ? [...at.order, 'votos DESC'] : at.order)}`,
    limit(state.rows),
  ])
}
