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

/** The end of an `E'...'` string, where a backslash escapes the next character. */
function escapedEnd(text: string, start: number): number {
  let index = start + 2
  while (index < text.length) {
    if (text[index] === '\\') index += 2
    else if (text[index] === "'" && text[index + 1] === "'") index += 2
    else if (text[index] === "'") return index + 1
    else index += 1
  }
  return text.length
}

/** The end of a block comment, which DuckDB lets nest. */
function commentEnd(text: string, start: number): number {
  let depth = 0
  let index = start
  while (index < text.length) {
    if (text.startsWith('/*', index)) {
      depth += 1
      index += 2
    } else if (text.startsWith('*/', index)) {
      depth -= 1
      index += 2
      if (depth === 0) return index
    } else index += 1
  }
  return text.length
}

const DOLLAR_QUOTE = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/

/**
 * Scans `sql` for table names outside string literals and comments, without case, quoted or
 * not, and splits it at each semicolon outside them. A false match only costs a download, and
 * a split that DuckDB reads otherwise only fails the run, after the engine's lock.
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
      index = commentEnd(sql, index)
    } else if ((char === 'E' || char === 'e') && next === "'") {
      index = escapedEnd(sql, index)
    } else if (char === "'") {
      index = quotedEnd(sql, index, "'")
    } else if (char === '"') {
      const end = quotedEnd(sql, index, '"')
      note(sql.slice(index + 1, end - 1).replaceAll('""', '"'))
      index = end
    } else if (char === '$' && DOLLAR_QUOTE.test(sql.slice(index, index + 66))) {
      const delimiter = DOLLAR_QUOTE.exec(sql.slice(index, index + 66))?.[0] ?? '$$'
      const end = sql.indexOf(delimiter, index + delimiter.length)
      index = end === -1 ? sql.length : end + delimiter.length
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
