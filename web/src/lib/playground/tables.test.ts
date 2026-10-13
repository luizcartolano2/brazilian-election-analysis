import { describe, expect, it } from 'vitest'
import { scanQuery } from './tables'

const tables = (sql: string) => [...scanQuery(sql).tables].sort()

describe('scanQuery', () => {
  it('finds each table that a query names', () => {
    expect(
      tables(
        'SELECT m.nome, sum(v.votos) FROM votos_municipio v JOIN municipios m USING (municipio) GROUP BY 1',
      ),
    ).toEqual(['municipios', 'votos_municipio'])
  })

  it('ignores names inside string literals and comments', () => {
    expect(
      tables("SELECT 'votos_secao' AS texto -- secoes\n/* candidatos */ FROM range(3)"),
    ).toEqual([])
    expect(tables("SELECT 'it''s votos_zona' FROM $$secoes$$, municipios")).toEqual(['municipios'])
  })

  it('finds a quoted name, and a name in any case', () => {
    expect(tables('SELECT * FROM "Votos_Secao", SECOES')).toEqual(['secoes', 'votos_secao'])
  })

  it('never takes a column, or a longer name that starts with a table name, for a table', () => {
    expect(tables('SELECT votos, secao, municipio FROM votos_secaox, range(1)')).toEqual([])
  })

  it('finds no table in a query that names none', () => {
    expect(tables('SELECT 42 AS resposta')).toEqual([])
  })

  it('splits statements at semicolons outside strings and comments', () => {
    expect(
      scanQuery("CREATE TEMP TABLE t AS SELECT ';' AS c; -- one; two\nSELECT * FROM t;").statements,
    ).toEqual(["CREATE TEMP TABLE t AS SELECT ';' AS c", ' -- one; two\nSELECT * FROM t'])
  })

  it('reads escaped strings, tagged dollar quotes and nested comments as DuckDB does', () => {
    const scan = scanQuery(
      "SELECT E'it\\'s; votos_secao' AS a, $q$x; secoes$q$ AS b /* c /* d; */ municipios; */ FROM votos_zona",
    )
    expect(scan.statements).toHaveLength(1)
    expect([...scan.tables]).toEqual(['votos_zona'])
  })

  it('drops statements that hold only blanks and comments', () => {
    expect(scanQuery('  ;  -- nothing\n; SELECT 1 ;  ').statements).toEqual([' SELECT 1 '])
  })
})
