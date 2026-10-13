/** Kept apart from `i18n.ts`, so that client code can build addresses without both message files. */
import { YEAR, type Round } from './elections'
import type { Locale } from './i18n'

/** The address of a page in a locale. `path` is the Portuguese address, such as `/2026/pe/`. */
export function localePath(locale: Locale, path: string): string {
  return locale === 'pt' ? path : `/en${path}`
}

/** The Portuguese addresses of the two pages that the header links to besides the results. */
export const PLAYGROUND_PATH = `/${YEAR}/consultas/`
export const SOURCES_PATH = `/${YEAR}/fontes/`

/** Round 2's pages live under this slug, the same in both languages. */
export const RUNOFF_SLUG = 'segundo-turno'

/** A Portuguese round-1 address, such as `/2026/pe/`, moved to the same page in a round. */
export function roundPath(round: Round, path: string): string {
  return round === 1 ? path : path.replace(/^\/(\d{4})\//, `/$1/${RUNOFF_SLUG}/`)
}
