/** Number formats, kept apart from `i18n.ts` so that client code gets no message files. */
import type { Locale } from './i18n'

export const NUMBER_LOCALES: Record<Locale, string> = { pt: 'pt-BR', en: 'en-US' }

export function formatInteger(locale: Locale, value: number): string {
  return new Intl.NumberFormat(NUMBER_LOCALES[locale]).format(value)
}

/** A share such as 0.47027 becomes `47,03%` or `47.03%`. No share exists of nothing. */
export function formatShare(locale: Locale, part: number, whole: number): string {
  if (whole <= 0) return '–'
  return new Intl.NumberFormat(NUMBER_LOCALES[locale], {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(part / whole)
}

/** Percentage points with one decimal, such as `3,9` or `3.9`. */
export function formatPoints(locale: Locale, points: number): string {
  return new Intl.NumberFormat(NUMBER_LOCALES[locale], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(points)
}
