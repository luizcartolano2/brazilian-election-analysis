/**
 * Reads a query's text without a parser: the tables it names, so a run downloads only their
 * files, and its statements, because the engine streams one statement at a time.
 */
import { TABLES } from './catalog'

const NAMES = new Set(TABLES.map((table) => table.name))

interface Scan {
  tables: Set<string>
  statements: string[]
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_]/.test(char)
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_$]/.test(char)
}

/** The end of a quoted run that starts at `start`, where a doubled quote stands for itself. */
function quotedEnd(text: string, start: number, quote: string): number {
  let index = start + 1
  while (index < text.length) {
    if (text[index] === quote) {
      if (text[index + 1] === quote) {
        index += 2
        continue
      }
      return index + 1
    }
    index += 1
  }
  return text.length
}

/**
 * Scans `sql` for table names outside string literals and comments, without case, quoted or
 * not, and splits it at each semicolon outside them. A false match only costs a download.
 */
export function scanQuery(sql: string): Scan {
  const tables = new Set<string>()
  const statements: string[] = []
  let statementStart = 0
  let index = 0
  const note = (name: string) => {
    const lowered = name.toLowerCase()
    if (NAMES.has(lowered)) tables.add(lowered)
  }
  while (index < sql.length) {
    const char = sql[index] ?? ''
    const next = sql[index + 1] ?? ''
    if (char === '-' && next === '-') {
      const end = sql.indexOf('\n', index)
      index = end === -1 ? sql.length : end + 1
    } else if (char === '/' && next === '*') {
      const end = sql.indexOf('*/', index + 2)
      index = end === -1 ? sql.length : end + 2
    } else if (char === "'") {
      index = quotedEnd(sql, index, "'")
    } else if (char === '"') {
      const end = quotedEnd(sql, index, '"')
      note(sql.slice(index + 1, end - 1).replaceAll('""', '"'))
      index = end
    } else if (char === '$' && next === '$') {
      const end = sql.indexOf('$$', index + 2)
      index = end === -1 ? sql.length : end + 2
    } else if (isIdentifierStart(char)) {
      let end = index + 1
      while (end < sql.length && isIdentifierPart(sql[end] ?? '')) end += 1
      note(sql.slice(index, end))
      index = end
    } else if (char === ';') {
      statements.push(sql.slice(statementStart, index))
      statementStart = index + 1
      index += 1
    } else {
      index += 1
    }
  }
  statements.push(sql.slice(statementStart))
  return {
    tables,
    statements: statements.filter((statement) => hasCode(statement)),
  }
}

/** Whether a statement holds anything but blanks and comments. */
function hasCode(statement: string): boolean {
  const stripped = statement.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  return stripped.trim() !== ''
}
