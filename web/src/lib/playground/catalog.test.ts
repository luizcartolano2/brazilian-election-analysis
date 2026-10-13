import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Manifest } from '../manifest'
import { ADDED_COLUMNS, matchPath, shownColumns, TABLES } from './catalog'

const WEB = path.join(import.meta.dirname, '..', '..', '..')

function fixtureManifest(folder: string): Manifest {
  return JSON.parse(readFileSync(path.join(WEB, folder, 'manifest.json'), 'utf-8')) as Manifest
}

describe('the catalog', () => {
  it('describes every table and column in both languages', () => {
    for (const table of TABLES) {
      expect(table.pt.trim(), table.name).not.toBe('')
      expect(table.en.trim(), table.name).not.toBe('')
      for (const column of shownColumns(table)) {
        expect(column.pt.trim(), `${table.name}.${column.name}`).not.toBe('')
        expect(column.en.trim(), `${table.name}.${column.name}`).not.toBe('')
      }
    }
  })

  it('names each vote type code in both languages, from candidate to annulled sub judice', () => {
    const types = TABLES.flatMap((table) =>
      table.columns.filter((column) => column.name === 'tipo'),
    )
    expect(types.length).toBeGreaterThan(0)
    for (const column of types) {
      expect(column.pt).toContain(
        '1 candidato, 2 legenda, 3 branco, 4 nulo, 5 nulo técnico, 6 anulado, 7 anulado sub judice',
      )
      expect(column.en).toContain(
        '1 candidate, 2 party list, 3 blank, 4 null, 5 technical null, 6 annulled, 7 annulled sub judice',
      )
    }
  })

  it('names no table like a column, so a scan for table names never takes a column', () => {
    const columns = new Set([
      ...TABLES.flatMap((table) => table.columns.map((column) => column.name)),
      ...Object.keys(ADDED_COLUMNS),
    ])
    for (const table of TABLES) expect(columns.has(table.name), table.name).toBe(false)
  })

  it('never adds a column that a file already holds', () => {
    for (const table of TABLES) {
      const own = table.columns.map((column) => column.name)
      for (const added of table.added) expect(own, `${table.name}.${added}`).not.toContain(added)
    }
  })

  it.each([
    ['fixtures', 1],
    ['fixtures-t2', 2],
  ] as const)('feeds every table from the %s manifest', (folder, round) => {
    const matched = fixtureManifest(folder)
      .arquivos.map((entry) => matchPath(entry.path, round))
      .filter((match) => match !== null)
    const tables = new Set(matched.map((match) => match.table))
    expect([...tables].sort()).toEqual(TABLES.map((table) => table.name).sort())
  })
})

describe('matchPath', () => {
  it('reads the round, the race and the area from a path', () => {
    expect(matchPath('2026/t1/votos/cargo=6/uf=PE.parquet', 1)).toEqual({
      table: 'votos_secao',
      round: 1,
      race: 6,
      area: 'pe',
    })
    expect(matchPath('2026/t2/totais/municipio/comparecimento/uf=ZZ.parquet', 2)).toEqual({
      table: 'comparecimento_municipio',
      round: 2,
      race: null,
      area: 'zz',
    })
    expect(matchPath('2026/municipios.parquet', 2)).toEqual({
      table: 'municipios',
      round: 2,
      race: null,
      area: null,
    })
  })

  it('names no table for a file outside the catalog', () => {
    expect(matchPath('2026/t1/resumo/pe.json', 1)).toBeNull()
    expect(matchPath('2026/t1/estimativas/uf=PE.parquet', 1)).toBeNull()
    expect(matchPath('2026/t1/votos/cargo=6/uf=pe.parquet', 1)).toBeNull()
  })

  it("refuses a file whose round differs from its version's", () => {
    expect(matchPath('2026/t1/candidatos.parquet', 2)).toBeNull()
  })
})
