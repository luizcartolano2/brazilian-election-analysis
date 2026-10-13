/**
 * Collects a streamed result: the rows that the table shows, and the CSV text, within limits
 * that bound the tab's memory whatever the rows hold.
 */
import { BYTE_ORDER_MARK, csvLine, csvPreamble } from './csv'

export const LIMITS = {
  shownRows: 1000,
  cellCharacters: 500,
  keptRows: 1_000_000,
  keptBytes: 100_000_000,
}

export type Limits = typeof LIMITS
export type PassedLimit = 'rows' | 'bytes'

export interface ResultColumn {
  name: string
  /** The Arrow type, as DuckDB-WASM names it, such as `Int64` or `Date32<DAY>`. */
  type: string
}

/** A value as the table and the file show it: a date as text, a list or a record as text. */
export function plainValue(value: unknown, type: string): unknown {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && type.startsWith('Date')) {
    return new Date(value).toISOString().slice(0, 10)
  }
  if (typeof value === 'number' && type.startsWith('Timestamp')) {
    return new Date(value)
      .toISOString()
      .replace('T', ' ')
      .replace(/\.000Z$|Z$/, '')
  }
  if (['string', 'number', 'bigint', 'boolean'].includes(typeof value)) return value
  return String(value)
}

/** UTF-8 bytes of a text, without encoding it. */
export function utf8Length(text: string): number {
  let bytes = 0
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4
      index += 1
    } else bytes += 3
  }
  return bytes
}

export class ResultCollector {
  readonly shown: unknown[][] = []
  readonly chunks: Uint8Array[] = []
  rows = 0
  bytes: number
  passed: PassedLimit | null = null
  private readonly encoder = new TextEncoder()

  constructor(
    readonly columns: ResultColumn[],
    private readonly limits: Limits = LIMITS,
  ) {
    const header = csvLine(columns.map((column) => column.name))
    this.chunks.push(this.encoder.encode(header))
    this.bytes = utf8Length(header)
  }

  /** Adds a batch's rows. Returns false once the result passes a limit, so the run stops. */
  add(batch: unknown[][]): boolean {
    if (this.passed !== null) return false
    const lines: string[] = []
    for (const raw of batch) {
      if (this.rows >= this.limits.keptRows) {
        this.passed = 'rows'
        break
      }
      const row = raw.map((value, index) => plainValue(value, this.columns[index]?.type ?? ''))
      const line = csvLine(row)
      const length = utf8Length(line)
      if (this.bytes + length > this.limits.keptBytes) {
        this.passed = 'bytes'
        break
      }
      lines.push(line)
      this.bytes += length
      this.rows += 1
      if (this.shown.length < this.limits.shownRows) {
        this.shown.push(
          row.map((value) =>
            typeof value === 'string' && value.length > this.limits.cellCharacters
              ? `${value.slice(0, this.limits.cellCharacters)}…`
              : value,
          ),
        )
      }
    }
    if (lines.length > 0) this.chunks.push(this.encoder.encode(lines.join('')))
    return this.passed === null
  }

  /** The file's parts: the byte order mark and the comment lines, then the header and rows. */
  fileParts(comments: string[]): Uint8Array[] {
    if (this.passed !== null) throw new Error('a result past its limits has no file')
    return [this.encoder.encode(BYTE_ORDER_MARK + csvPreamble(comments)), ...this.chunks]
  }
}
