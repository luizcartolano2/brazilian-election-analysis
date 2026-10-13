import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { nodeRunner } from '../../../scripts/duckdb-node'
import { rows, startSandbox, type Sandbox } from '../../../scripts/playground-sandbox'
import type { Run } from '../drilldown/queries'
import { formatShare } from '../format'
import type { Summary } from '../results'
import type { DataChoice } from './choice'
import {
  formQuery,
  PLACE_LEVELS,
  QUESTIONS,
  shareSql,
  type FormState,
  type PlaceLevel,
  type Question,
} from './form'
import { scanQuery } from './tables'

const WEB = path.join(import.meta.dirname, '..', '..', '..')

function summary(area: string): Summary {
  return JSON.parse(
    readFileSync(path.join(WEB, 'fixtures', '2026', 't1', 'resumo', `${area}.json`), 'utf-8'),
  ) as Summary
}

function state(question: Question, level: PlaceLevel, extra: Partial<FormState> = {}): FormState {
  return {
    question,
    level,
    race: 1,
    candidate: question === 'one' ? { area: 'br', numero: 13 } : null,
    order: 'desc',
    rows: null,
    ...extra,
  }
}

const BRAZIL: DataChoice = { rounds: [1], races: [1], areas: ['br'] }
const ACRE: DataChoice = { rounds: [1], races: [1], areas: ['ac'] }

describe('formQuery', () => {
  it.each(QUESTIONS.flatMap((question) => PLACE_LEVELS.map((level) => [question, level] as const)))(
    'names the tables that it reads for %s by %s',
    (question, level) => {
      const tables = scanQuery(formQuery(state(question, level), BRAZIL)).tables
      const reads = question === 'turnout' ? 'comparecimento' : 'votos'
      const levelTable = level === 'uf' ? 'municipio' : level
      expect(tables).toContain(`${reads}_${levelTable}`)
      expect(tables.has('municipios')).toBe(level !== 'uf')
      expect(tables.has('candidatos')).toBe(question === 'each')
    },
  )

  it('takes no text: an area outside the list, or a number that is not whole, fails', () => {
    expect(() =>
      formQuery(state('one', 'uf', { race: 3, candidate: { area: "x' OR 1=1 --", numero: 13 } }), {
        ...BRAZIL,
        races: [3],
      }),
    ).toThrow(/is not an area/)
    expect(() =>
      formQuery(state('one', 'uf', { candidate: { area: 'br', numero: 1.5 } }), BRAZIL),
    ).toThrow(/whole number/)
    expect(() => formQuery(state('each', 'uf', { race: 3 }), BRAZIL)).toThrow(
      /not in the data choice/,
    )
  })
})

describe('shareSql', () => {
  let run: Run

  beforeAll(async () => {
    run = await nodeRunner()
  }, 30_000)

  it('rounds a share that ends in five up, as the pages print it', async () => {
    const [row] = await run(
      `SELECT ${shareSql('41', '4000')} AS s, ${shareSql('1397', '4000')} AS t`,
      [],
    )
    expect(row).toEqual({ s: 1.03, t: 34.93 })
    expect(formatShare('pt', 41, 4000)).toBe('1,03%')
    expect(formatShare('pt', 1397, 4000)).toBe('34,93%')
  })

  it('gives no share of nothing', async () => {
    const [row] = await run(`SELECT ${shareSql('0', '0')} AS s`, [])
    expect(row).toEqual({ s: null })
  })

  it('groups two municipalities that share a name apart', async () => {
    await run(
      'CREATE OR REPLACE TABLE votos_municipio AS SELECT * FROM (VALUES ' +
        "(1, 'GO', 1, 1, 1, 13, 60), (1, 'GO', 1, 1, 1, 22, 40), " +
        "(1, 'PI', 2, 1, 1, 13, 10), (1, 'PI', 2, 1, 1, 22, 90)) " +
        't(turno, uf, municipio, cargo, tipo, numero, votos)',
      [],
    )
    await run(
      "CREATE OR REPLACE TABLE municipios AS SELECT * FROM (VALUES (1, 'BOM JESUS', 'GO'), (2, 'BOM JESUS', 'PI')) t(municipio, nome, uf)",
      [],
    )
    const result = await run(formQuery(state('one', 'municipio'), BRAZIL), [])
    expect(result).toEqual([
      { uf: 'GO', municipio: 'BOM JESUS', votos: 60n, percentual_validos: 60 },
      { uf: 'PI', municipio: 'BOM JESUS', votos: 10n, percentual_validos: 10 },
    ])
  })
})

describe('the form on the fixtures', () => {
  let sandbox: Sandbox

  beforeAll(async () => {
    sandbox = await startSandbox()
  }, 30_000)

  afterAll(() => sandbox.stop())

  it("gives one candidate's votes and share in each municipality of Acre, as the pages do", () => {
    const connection = sandbox.fresh(ACRE)
    const result = rows(connection, formQuery(state('one', 'municipio'), ACRE))
    const expected = rows(
      connection,
      'SELECT municipio, sum(votos) FILTER (WHERE tipo = 1 AND numero = 13) AS votos, ' +
        'sum(votos) FILTER (WHERE tipo IN (1, 2)) AS validos FROM votos_municipio GROUP BY municipio',
    )
    expect(result.length).toBe(expected.filter((row) => row.votos !== null).length)
    const named = rows(connection, "SELECT municipio, nome FROM municipios WHERE uf = 'AC'")
    for (const row of result) {
      const code = named.find((entry) => entry.nome === row.municipio)?.municipio
      const page = expected.find((entry) => entry.municipio === code)
      expect(row.uf).toBe('AC')
      expect(Number(row.votos)).toBe(Number(page?.votos))
      const printed = formatShare('en', Number(page?.votos), Number(page?.validos))
      expect(`${Number(row.percentual_validos).toFixed(2)}%`).toBe(printed)
    }
  })

  it("gives each state's turnout for Brazil, as each state's page does", () => {
    const connection = sandbox.fresh(BRAZIL)
    const result = rows(connection, formQuery(state('turnout', 'uf', { order: 'place' }), BRAZIL))
    expect(result.map((row) => row.uf)).toEqual(['AC', 'PE', 'SE', 'ZZ'])
    for (const row of result) {
      const president = summary(String(row.uf).toLowerCase()).corridas.find(
        (race) => race.cargo === 1,
      )
      expect([Number(row.aptos), Number(row.comparecimento), Number(row.abstencoes)]).toEqual([
        president?.aptos,
        president?.comparecimento,
        president?.abstencoes,
      ])
    }
  })

  it('lists each municipality once for each round when both rounds are chosen', () => {
    const both: DataChoice = { rounds: [1, 2], races: [1], areas: ['ac'] }
    const connection = sandbox.fresh(both)
    const result = rows(connection, formQuery(state('one', 'municipio', { order: 'place' }), both))
    const keys = result.map((row) => `${row.turno}/${row.municipio}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(result.map((row) => row.turno))).toEqual(new Set([1, 2]))
    const perRound = (round: number) => result.filter((row) => row.turno === round).length
    expect(perRound(1)).toBe(perRound(2))
  })

  it.each(QUESTIONS.flatMap((question) => PLACE_LEVELS.map((level) => [question, level] as const)))(
    'runs %s by %s',
    (question, level) => {
      const connection = sandbox.fresh(BRAZIL)
      expect(rows(connection, formQuery(state(question, level), BRAZIL)).length).toBeGreaterThan(0)
    },
  )
})
