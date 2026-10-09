import en from '../../messages/en.json'
import pt from '../../messages/pt.json'
import { NUMBER_LOCALES } from './format'

export { formatInteger, formatOrdinal, formatPoints, formatShare } from './format'
export { localePath } from './paths'

export type Locale = 'pt' | 'en'

export const LOCALES: readonly Locale[] = ['pt', 'en']

export type MessageKey = keyof typeof pt

const MESSAGES: Record<Locale, Record<MessageKey, string>> = { pt, en }

/** Looks up a message and fills `{name}` placeholders. */
export function t(locale: Locale, key: MessageKey, values: Record<string, string> = {}): string {
  return MESSAGES[locale][key].replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match)
}

/** A calendar date such as `2026-10-04`, which has no time of day and so no time zone. */
export function formatDate(locale: Locale, isoDate: string): string {
  return new Intl.DateTimeFormat(NUMBER_LOCALES[locale], {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`))
}

/** A date with no year, such as "4 de outubro". */
export function formatDayMonth(locale: Locale, isoDate: string): string {
  return new Intl.DateTimeFormat(NUMBER_LOCALES[locale], {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`))
}

export function formatDateTime(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(NUMBER_LOCALES[locale], {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}
