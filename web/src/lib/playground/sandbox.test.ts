import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fixtureFiles, rows, startSandbox, type Sandbox } from '../../../scripts/playground-sandbox'
import type { Summary } from '../results'
import type { DataChoice } from './choice'
import type { PlaygroundFile } from './files'
import { columnProblems } from './sandbox'

const WEB = path.join(import.meta.dirname, '..', '..', '..')
const ACRE_PRESIDENT: DataChoice = { rounds: [1], races: [1], areas: ['ac'] }

function summary(area: string): Summary {
  return JSON.parse(
    readFileSync(path.join(WEB, 'fixtures', '2026', 't1', 'resumo', `${area}.json`), 'utf-8'),
  ) as Summary
}

describe('a run in the locked sandbox', () => {
  let sandbox: Sandbox

  beforeAll(async () => {
    sandbox = await startSandbox()
  }, 30_000)

  afterAll(() => sandbox.stop())

  it('reads the chosen files through the views, with the columns from their paths', () => {
    const connection = sandbox.fresh(ACRE_PRESIDENT)
    const [counts] = rows(
      connection,
      'SELECT count(DISTINCT uf) AS areas, min(turno) AS turno, min(cargo) AS cargo FROM votos_secao',
    )
    expect(counts).toEqual({ areas: 1n, turno: 1, cargo: 1 })
  })

  it('counts each voter once in the turnout of one race', () => {
    const connection = sandbox.fresh(ACRE_PRESIDENT)
    const [turnout] = rows(connection, 'SELECT sum(aptos) AS aptos FROM comparecimento_municipio')
    const president = summary('ac').corridas.find((race) => race.cargo === 1)
    expect(Number(turnout?.aptos)).toBe(president?.aptos)
  })

  it("keeps the President's candidates for a state", () => {
    const connection = sandbox.fresh(ACRE_PRESIDENT)
    const [candidates] = rows(connection, "SELECT count(*) AS n FROM candidatos WHERE uf = 'BR'")
    expect(Number(candidates?.n)).toBeGreaterThan(0)
  })

  it.each([
    [
      "another data version's file",
      "SELECT * FROM read_parquet('https://eleicoes-data.luizcartolano.workers.dev/v/20260101-0000000-1/2026/t1/votos/cargo=1/uf=AC.parquet')",
    ],
    ["another site's CSV", "SELECT * FROM read_csv('https://example.com/x.csv')"],
    [
      'a registered file outside the choice',
      "SELECT * FROM read_parquet('/consultas/2026/t1/votos/cargo=1/uf=PE.parquet')",
    ],
    [
      'a path that climbs out',
      "SELECT * FROM read_parquet('/consultas/2026/t1/../t1/votos/cargo=1/uf=PE.parquet')",
    ],
    ['a turn of file access back on', 'SET enable_external_access = true'],
    ['a wider list of files', "SET allowed_directories = ['/']"],
    ['an unlock', 'RESET lock_configuration'],
    ['a copy to a file', "COPY (SELECT 1 AS x) TO '/consultas/2026/municipios.parquet'"],
    ['an attached database file', "ATTACH '/consultas/2026/t1/votos.duckdb' AS other"],
    ['an extension', 'LOAD json'],
  ])('refuses %s', (_, sql) => {
    const connection = sandbox.fresh(ACRE_PRESIDENT)
    expect(() => connection.query(sql)).toThrow(/Permission Error|locked|disabled/)
  })

  it("starts each run without the last run's macros, schemas or databases", () => {
    const pinned = rows(
      sandbox.fresh(ACRE_PRESIDENT),
      'SELECT sum(votos) AS votos FROM votos_municipio',
    )
    const hostile = sandbox.fresh(ACRE_PRESIDENT)
    hostile.query('CREATE MACRO round(x, d) AS 99')
    hostile.query('CREATE TEMP MACRO sum(x) AS 42')
    hostile.query('CREATE TEMP VIEW votos_municipio AS SELECT 1 AS votos')
    expect(rows(hostile, 'SELECT round(2.345::DOUBLE, 2) AS r')).toEqual([{ r: 99 }])
    expect(rows(hostile, 'SELECT sum(votos) AS votos FROM votos_municipio')).toEqual([
      { votos: 42 },
    ])
    hostile.query("ATTACH ':memory:' AS other")
    hostile.query('CREATE SCHEMA other.main2')
    hostile.query('USE other')
    const next = sandbox.fresh(ACRE_PRESIDENT)
    expect(rows(next, 'SELECT round(2.345::DOUBLE, 2) AS r')).toEqual([{ r: 2.35 }])
    expect(rows(next, 'SELECT sum(votos) AS votos FROM votos_municipio')).toEqual(pinned)
    expect(rows(next, 'SELECT current_database() AS d')).toEqual([{ d: 'memory' }])
  })

  it('leaves a chosen file as it was after an attach of it, which opens an empty database', () => {
    const count = 'SELECT count(*) AS n, sum(municipio) AS total FROM municipios'
    const before = rows(sandbox.fresh(ACRE_PRESIDENT), count)
    const hostile = sandbox.fresh(ACRE_PRESIDENT)
    hostile.query("ATTACH '/consultas/2026/municipios.parquet' AS other")
    hostile.query('CREATE TABLE other.t AS SELECT 1 AS x')
    expect(rows(sandbox.fresh(ACRE_PRESIDENT), count)).toEqual(before)
  })
})

describe('columnProblems', () => {
  const file = fixtureFiles().find((entry) => entry.table === 'votos_secao') as PlaygroundFile

  it('names a column that the catalog does not describe, and one that a file lacks', () => {
    expect(
      columnProblems(file, [
        { name: 'municipio', type: 'INTEGER' },
        { name: 'zona', type: 'SMALLINT' },
        { name: 'secao', type: 'SMALLINT' },
        { name: 'tipo', type: 'TINYINT' },
        { name: 'numero', type: 'INTEGER' },
        { name: 'votos', type: 'BIGINT' },
        { name: 'cpf', type: 'VARCHAR' },
      ]),
    ).toEqual([
      'votos_secao: column cpf is not in the catalog',
      'votos_secao: column votos is BIGINT, the catalog says INTEGER',
    ])
    expect(columnProblems(file, [{ name: 'municipio', type: 'INTEGER' }])).toContain(
      'votos_secao: column votos is missing',
    )
  })
})
