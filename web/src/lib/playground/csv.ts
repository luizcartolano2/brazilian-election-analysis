/** The CSV file of a result: the credit and the link first, then the header and the rows. */
import { YEAR, type Round } from '../elections'

/** So that a spreadsheet reads the accents as UTF-8. */
export const BYTE_ORDER_MARK = '\uFEFF'

const LINE_END = '\r\n'

/**
 * A spreadsheet runs a cell that starts with one of these as a formula. OWASP lists all but the
 * line feed, which the guard covers too.
 */
const FORMULA_START = /^[=+\-@\t\r\n]/

/** The text of a value as the file holds it, with no quoting. */
export function rawText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

/**
 * One cell, with RFC 4180 quoting. A text that starts like a formula gets a leading quote. A
 * number never does, so a negative number stays a number.
 */
export function csvCell(value: unknown): string {
  let text = rawText(value)
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function csvLine(values: unknown[]): string {
  return values.map(csvCell).join(',') + LINE_END
}

/**
 * The comment lines. Each one holds only the page's own text and the link, whose characters
 * never split a line into cells. A query's own text would: a spreadsheet knows no comments.
 */
export function csvPreamble(lines: string[]): string {
  for (const line of lines) {
    if (/[\r\n]/.test(line)) throw new Error('a comment line holds a line break')
  }
  return lines.map((line) => `# ${line}${LINE_END}`).join('')
}

export interface NamedVersion {
  round: Round
  version: string
}

export function csvFileName(versions: NamedVersion[]): string {
  const parts = versions.map((entry) => `t${entry.round}-${entry.version}`)
  return `consulta-${YEAR}-${parts.join('-')}.csv`
}
