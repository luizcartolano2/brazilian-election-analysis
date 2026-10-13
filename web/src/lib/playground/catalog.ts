/** The tables and columns that the playground exposes, and the published files behind them. */
import catalog from './catalog.json'
import type { Round } from '../elections'
import type { Locale } from '../i18n'

export type AddedColumn = 'turno' | 'uf' | 'cargo'

/** Which rows of its files a table keeps for a data choice. */
export type RowRule = 'all' | 'races' | 'races-and-areas' | 'round-1'

export interface CatalogColumn {
  name: string
  type: string
  pt: string
  en: string
}

export interface CatalogTable {
  name: string
  pt: string
  en: string
  /** The file's path inside a data version, with `{turno}`, `{cargo}` and `{uf}` for its parts. */
  path: string
  added: AddedColumn[]
  rows: RowRule
  columns: CatalogColumn[]
}

export const TABLES = catalog.tables as CatalogTable[]

export const ADDED_COLUMNS = catalog.added as Record<
  AddedColumn,
  { type: string; pt: string; en: string }
>

export function tableByName(name: string): CatalogTable | undefined {
  return TABLES.find((table) => table.name === name)
}

/** A published file's place in the catalog. */
export interface CatalogMatch {
  table: string
  round: Round
  race: number | null
  /** The area in lower case, as the app writes it, or null for a file with no area. */
  area: string | null
}

const PATTERNS = TABLES.map((table) => {
  const source = table.path
    .split(/(\{turno\}|\{cargo\}|\{uf\})/)
    .map((part) => {
      if (part === '{turno}') return '(?<turno>[12])'
      if (part === '{cargo}') return '(?<cargo>\\d{1,2})'
      if (part === '{uf}') return '(?<uf>[A-Z]{2})'
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('')
  return { table, pattern: new RegExp(`^${source}$`) }
})

/**
 * The table that a file feeds, or null for a file that the catalog names for no table.
 * `round` is the round of the version that holds the file, for a path with no `{turno}`.
 */
export function matchPath(path: string, round: Round): CatalogMatch | null {
  for (const { table, pattern } of PATTERNS) {
    const match = pattern.exec(path)
    if (match === null) continue
    const groups = match.groups ?? {}
    if (groups.turno !== undefined && Number(groups.turno) !== round) return null
    return {
      table: table.name,
      round,
      race: groups.cargo === undefined ? null : Number(groups.cargo),
      area: groups.uf === undefined ? null : groups.uf.toLowerCase(),
    }
  }
  return null
}

export function tableDescription(table: CatalogTable, locale: Locale): string {
  return table[locale]
}

/** A table's columns as the playground shows them: the file's, then those it adds. */
export function shownColumns(table: CatalogTable): CatalogColumn[] {
  return [...table.columns, ...table.added.map((name) => ({ name, ...ADDED_COLUMNS[name] }))]
}
