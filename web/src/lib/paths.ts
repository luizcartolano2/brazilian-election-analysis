/** Kept apart from `i18n.ts`, so that client code can build addresses without both message files. */
import type { Locale } from './i18n'

/** The address of a page in a locale. `path` is the Portuguese address, such as `/2026/pe/`. */
export function localePath(locale: Locale, path: string): string {
  return locale === 'pt' ? path : `/en${path}`
}
