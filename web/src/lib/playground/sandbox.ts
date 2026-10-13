/**
 * The statements that set up each run's fresh database: the playground's views over the
 * registered files, then the settings that confine every later statement to those files.
 */
import { tableByName, type CatalogTable } from './catalog'
import { isBrazil, registeredName, type DataChoice } from './choice'
import type { PlaygroundFile } from './files'

/** 1 GB, so a heavy query fails with an error before the tab runs out of memory. */
export const MEMORY_LIMIT = '1GB'

/** A SQL string literal. Every name here comes from the build's file list, never from a visitor. */
export function sqlString(text: string): string {
  return `'${text.replaceAll("'", "''")}'`
}

const ADDED_SQL = {
  turno: "CAST(regexp_extract(filename, '/t([12])/', 1) AS TINYINT) AS turno",
  uf: "regexp_extract(filename, 'uf=([A-Z]{2})', 1) AS uf",
  cargo: "CAST(regexp_extract(filename, 'cargo=([0-9]+)', 1) AS TINYINT) AS cargo",
}

function areaCodes(choice: DataChoice): string {
  return choice.areas.map((area) => sqlString(area.toUpperCase())).join(', ')
}

/** The rows of the files that a table keeps for the choice. */
function rowFilter(table: CatalogTable, choice: DataChoice): string | null {
  const races = choice.races.map(Number).join(', ')
  if (table.rows === 'races') return `cargo IN (${races})`
  if (table.rows !== 'races-and-areas') return null
  if (isBrazil(choice)) return `cargo IN (${races})`
  // The pipeline writes the President's candidates once, under BR.
  return `cargo IN (${races}) AND (uf IN (${areaCodes(choice)}) OR (cargo = 1 AND uf = 'BR'))`
}

/** A view over the table's files, with the columns that the files' paths hold. */
export function viewStatement(
  tableName: string,
  files: PlaygroundFile[],
  choice: DataChoice,
): string {
  const table = tableByName(tableName)
  if (table === undefined) throw new Error(`the catalog has no table ${tableName}`)
  if (files.length === 0) throw new Error(`${tableName} has no files for this choice`)
  const names = files.map((file) => sqlString(registeredName(file))).join(', ')
  const added = table.added.map((column) => ADDED_SQL[column])
  const columns = ['* EXCLUDE (filename)', ...added].join(', ')
  const filter = rowFilter(table, choice)
  const source = `read_parquet([${names}], hive_partitioning = false, filename = true)`
  const inner = `SELECT ${columns} FROM ${source}`
  return filter === null
    ? `CREATE OR REPLACE VIEW ${table.name} AS ${inner}`
    : `CREATE OR REPLACE VIEW ${table.name} AS SELECT * FROM (${inner}) WHERE ${filter}`
}

/** The statements before the views: the Parquet extension, from the Worker only. */
export function extensionStatements(repository: string): string[] {
  return [
    'SET autoload_known_extensions = false',
    'SET autoinstall_known_extensions = false',
    `SET custom_extension_repository = ${sqlString(repository)}`,
    'LOAD parquet',
  ]
}

/**
 * The statements after the views and the catalog check. Once they run, the database reads no
 * other file, writes none, loads no extension, and refuses any change to these settings.
 */
export function lockStatements(allowedNames: string[]): string[] {
  const allowed = allowedNames.map(sqlString).join(', ')
  return [
    `SET memory_limit = ${sqlString(MEMORY_LIMIT)}`,
    `SET allowed_paths = [${allowed}]`,
    'SET enable_external_access = false',
    'SET lock_configuration = true',
  ]
}

export function describeStatement(file: PlaygroundFile): string {
  return `DESCRIBE SELECT * FROM read_parquet(${sqlString(registeredName(file))}, hive_partitioning = false)`
}

export interface DescribedColumn {
  name: string
  type: string
}

/** Each difference between a file's columns and its table's in the catalog. */
export function columnProblems(file: PlaygroundFile, described: DescribedColumn[]): string[] {
  const table = tableByName(file.table)
  if (table === undefined) return [`${file.path}: the catalog has no table ${file.table}`]
  const actual = new Map(described.map((column) => [column.name, column.type]))
  const expected = new Map(table.columns.map((column) => [column.name, column.type]))
  const problems: string[] = []
  for (const name of [...actual.keys()].sort()) {
    if (!expected.has(name)) problems.push(`${table.name}: column ${name} is not in the catalog`)
  }
  for (const name of [...expected.keys()].sort()) {
    const type = actual.get(name)
    if (type === undefined) problems.push(`${table.name}: column ${name} is missing`)
    else if (type !== expected.get(name)) {
      problems.push(
        `${table.name}: column ${name} is ${type}, the catalog says ${expected.get(name)}`,
      )
    }
  }
  return problems
}
