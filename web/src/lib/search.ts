/** The site search: the index files' format and field allowlist, matching, ranking and links. */
import { PRESIDENT, raceByCode, YEAR } from './elections'
import type { Locale } from './i18n'
import { localePath } from './paths'

export const MUNICIPALITY_FIELDS = ['nome', 'area', 'municipio', 'capital'] as const
export const CANDIDACY_FIELDS = [
  'nome',
  'numero',
  'partido',
  'cargo',
  'area',
  'resultado',
  'votos',
] as const

export type MunicipalityEntry = [nome: string, area: string, municipio: number, capital: boolean]
export type CandidacyEntry = [
  nome: string,
  numero: number,
  partido: string,
  cargo: number,
  area: string,
  resultado: string,
  votos: number,
]

/** Columns once, then rows, which keeps the candidate file small. */
export interface IndexFile<Row> {
  campos: readonly string[]
  linhas: Row[]
}

const FIELD_TYPES: Record<string, string> = {
  nome: 'string',
  area: 'string',
  municipio: 'number',
  capital: 'boolean',
  numero: 'number',
  partido: 'string',
  cargo: 'number',
  resultado: 'string',
  votos: 'number',
}

/** Throws unless the file holds exactly the allowed fields, in order, each with its type. */
export function checkIndexFile(
  name: string,
  file: IndexFile<unknown[]>,
  allowed: readonly string[],
): void {
  if (
    file.campos.length !== allowed.length ||
    file.campos.some((field, index) => field !== allowed[index])
  ) {
    throw new Error(
      `${name} holds the fields ${file.campos.join(', ')}, but only ${allowed.join(', ')} are allowed`,
    )
  }
  file.linhas.forEach((row, index) => {
    const valid =
      row.length === allowed.length &&
      row.every((value, column) => typeof value === FIELD_TYPES[allowed[column] ?? ''])
    if (!valid) throw new Error(`${name}: row ${index} does not hold exactly the allowed fields`)
  })
}

export type Hit =
  | { kind: 'municipality'; name: string; area: string; municipality: number; capital: boolean }
  | {
      kind: 'candidacy'
      name: string
      number: number
      party: string
      race: number
      area: string
      outcome: string
      votes: number
    }

interface Entry {
  hit: Hit
  /** The name without case or accents, with single spaces. */
  key: string
}

export interface SearchIndex {
  entries: Entry[]
}

export const MAX_RESULTS = 20
export const MIN_QUERY_LENGTH = 2

export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function prepareIndex(
  municipalities: IndexFile<MunicipalityEntry>,
  candidacies: IndexFile<CandidacyEntry>,
): SearchIndex {
  const entries: Entry[] = []
  for (const [name, area, municipality, capital] of municipalities.linhas) {
    entries.push({
      hit: { kind: 'municipality', name, area, municipality, capital },
      key: normalize(name),
    })
  }
  for (const [name, number, party, race, area, outcome, votes] of candidacies.linhas) {
    entries.push({
      hit: { kind: 'candidacy', name, number, party, race, area, outcome, votes },
      key: normalize(name),
    })
  }
  return { entries }
}

/** 0 for an exact ballot number, then names that start with the query, then a word, then any. */
function tier(entry: Entry, query: string, words: string[]): number | null {
  if (entry.hit.kind === 'candidacy' && /^\d+$/.test(query) && String(entry.hit.number) === query) {
    return 0
  }
  if (!words.every((word) => entry.key.includes(word))) return null
  if (entry.key.startsWith(query)) return 1
  if (` ${entry.key}`.includes(` ${query}`)) return 2
  return 3
}

function compare(a: { entry: Entry; tier: number }, b: { entry: Entry; tier: number }): number {
  if (a.tier !== b.tier) return a.tier - b.tier
  const first = a.entry.hit
  const second = b.entry.hit
  if (first.kind !== second.kind) return first.kind === 'municipality' ? -1 : 1
  if (first.kind === 'municipality' && second.kind === 'municipality') {
    if (first.capital !== second.capital) return first.capital ? -1 : 1
  }
  if (first.kind === 'candidacy' && second.kind === 'candidacy' && first.votes !== second.votes) {
    return second.votes - first.votes
  }
  return a.entry.key.localeCompare(b.entry.key) || first.area.localeCompare(second.area)
}

/**
 * At most MAX_RESULTS hits, best first, and whether more matched. A full ballot number lists
 * every candidacy that holds it, even past the cap, because each state numbers its own.
 */
export function search(index: SearchIndex, text: string): { hits: Hit[]; more: boolean } {
  const query = normalize(text)
  if (query.length < MIN_QUERY_LENGTH) return { hits: [], more: false }
  const words = query.split(' ')
  const matches: { entry: Entry; tier: number }[] = []
  for (const entry of index.entries) {
    const rank = tier(entry, query, words)
    if (rank !== null) matches.push({ entry, tier: rank })
  }
  matches.sort(compare)
  const shown = Math.max(MAX_RESULTS, matches.filter((match) => match.tier === 0).length)
  return {
    hits: matches.slice(0, shown).map((match) => match.entry.hit),
    more: matches.length > shown,
  }
}

/** The id of a candidacy's row in a race's full results. */
export function candidateRowId(number: number): string {
  return `candidato-${number}`
}

/** Where a hit leads. Candidacies go to their row on the race page, which holds every candidate. */
export function hitHref(hit: Hit, locale: Locale): string {
  if (hit.kind === 'municipality') {
    const query = new URLSearchParams({ uf: hit.area, mu: String(hit.municipality) })
    return `${localePath(locale, `/${YEAR}/municipio/`)}?${query.toString()}`
  }
  const race = raceByCode(hit.race)
  if (race === undefined) throw new Error(`the search index holds an unknown race, ${hit.race}`)
  const page = hit.race === PRESIDENT ? `/${YEAR}/` : `/${YEAR}/${hit.area}/${race.slug}/`
  return `${localePath(locale, page)}#${candidateRowId(hit.number)}`
}
