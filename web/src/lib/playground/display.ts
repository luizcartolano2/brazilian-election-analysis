/** How the playground prints sizes and the values of a result. */
import { NUMBER_LOCALES } from '../format'
import type { Locale } from '../i18n'

export function formatBytes(locale: Locale, bytes: number): string {
  const format = (value: number) =>
    new Intl.NumberFormat(NUMBER_LOCALES[locale], { maximumFractionDigits: 1 }).format(value)
  if (bytes < 1000) return `${format(bytes)} B`
  if (bytes < 1_000_000) return `${format(bytes / 1000)} kB`
  return `${format(bytes / 1_000_000)} MB`
}

export function isNumber(value: unknown): value is number | bigint {
  return typeof value === 'number' || typeof value === 'bigint'
}

/** A value in the table: numbers with the visitor's separators, the rest as the query gave it. */
export function formatCell(locale: Locale, value: unknown): string {
  if (value === null || value === undefined) return ''
  if (isNumber(value)) {
    return new Intl.NumberFormat(NUMBER_LOCALES[locale], { maximumFractionDigits: 6 }).format(value)
  }
  return String(value)
}
