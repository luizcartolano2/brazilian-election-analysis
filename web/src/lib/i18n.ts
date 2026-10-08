import en from '../../messages/en.json'
import pt from '../../messages/pt.json'

export { localePath } from './paths'

export type Locale = 'pt' | 'en'

export const LOCALES: readonly Locale[] = ['pt', 'en']

export type MessageKey = keyof typeof pt

const MESSAGES: Record<Locale, Record<MessageKey, string>> = { pt, en }

const NUMBER_LOCALES: Record<Locale, string> = { pt: 'pt-BR', en: 'en-US' }

/** Looks up a message and fills `{name}` placeholders. */
export function t(locale: Locale, key: MessageKey, values: Record<string, string> = {}): string {
  return MESSAGES[locale][key].replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match)
}

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

export function formatDateTime(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(NUMBER_LOCALES[locale], {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}
