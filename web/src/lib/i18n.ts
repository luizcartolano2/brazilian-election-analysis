import en from '../../messages/en.json'
import pt from '../../messages/pt.json'
import { NUMBER_LOCALES } from './format'

export { formatInteger, formatPoints, formatShare } from './format'
export { localePath } from './paths'

export type Locale = 'pt' | 'en'

export const LOCALES: readonly Locale[] = ['pt', 'en']

export type MessageKey = keyof typeof pt

const MESSAGES: Record<Locale, Record<MessageKey, string>> = { pt, en }

/** Looks up a message and fills `{name}` placeholders. */
export function t(locale: Locale, key: MessageKey, values: Record<string, string> = {}): string {
  return MESSAGES[locale][key].replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match)
}

export function formatDateTime(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(NUMBER_LOCALES[locale], {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}
