/**
 * The link that holds a query: the data choice, each round's data version and the query, in the
 * address's fragment, which the browser never sends to a server.
 */
import { AREAS, RACES, ROUNDS, type Round } from '../elections'
import { BRAZIL, type DataChoice } from './choice'

export const MAX_QUERY_LENGTH = 10_000
const FORMAT = 1
const PREFIX = '#c='

export interface LinkState {
  /** Each chosen round's data version, as the page named it when it made the link. */
  versions: Partial<Record<Round, string>>
  choice: DataChoice
  sql: string
}

interface Payload {
  v: number
  versoes: Record<string, string>
  turnos: number[]
  cargos: number[]
  areas: string[]
  sql: string
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('not URL-safe base64')
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

/** The fragment, starting with `#`, that holds the link's state. */
export function linkFragment(state: LinkState): string {
  const payload: Payload = {
    v: FORMAT,
    versoes: Object.fromEntries(Object.entries(state.versions)),
    turnos: state.choice.rounds,
    cargos: state.choice.races,
    areas: state.choice.areas,
    sql: state.sql,
  }
  return PREFIX + toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
}

export interface StaleVersion {
  round: Round
  linked: string
  pinned: string
}

export type LinkReading =
  | { status: 'none' }
  | { status: 'invalid' }
  | { status: 'valid'; state: LinkState; stale: StaleVersion[] }

const AREA_CODES = new Set(AREAS.map((area) => area.code))
const RACE_CODES = new Set(RACES.map((race) => race.code))

function distinctList<T>(value: unknown, accept: (item: unknown) => item is T): T[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  if (!value.every(accept)) return null
  return new Set(value).size === value.length ? (value as T[]) : null
}

/**
 * Reads a fragment as untrusted input. It accepts only pinned rounds, the election's races,
 * Brazil or the 27 states and `zz`, and a query of at most 10,000 characters, or nothing at all.
 */
export function readLink(fragment: string, pinned: Partial<Record<Round, string>>): LinkReading {
  if (!fragment.startsWith(PREFIX)) return { status: 'none' }
  let payload: Payload
  try {
    payload = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        fromBase64Url(fragment.slice(PREFIX.length)),
      ),
    ) as Payload
  } catch {
    return { status: 'invalid' }
  }
  if (payload === null || typeof payload !== 'object' || payload.v !== FORMAT) {
    return { status: 'invalid' }
  }
  const rounds = distinctList(
    payload.turnos,
    (item): item is Round => ROUNDS.includes(item as Round) && pinned[item as Round] !== undefined,
  )
  const races = distinctList(
    payload.cargos,
    (item): item is number => typeof item === 'number' && RACE_CODES.has(item),
  )
  const areas =
    Array.isArray(payload.areas) && payload.areas.length === 1 && payload.areas[0] === BRAZIL
      ? [BRAZIL]
      : distinctList(
          payload.areas,
          (item): item is string => typeof item === 'string' && AREA_CODES.has(item),
        )
  const sql = typeof payload.sql === 'string' ? payload.sql : null
  const versions = payload.versoes
  if (
    rounds === null ||
    races === null ||
    areas === null ||
    sql === null ||
    sql.length > MAX_QUERY_LENGTH ||
    versions === null ||
    typeof versions !== 'object'
  ) {
    return { status: 'invalid' }
  }
  const linked: Partial<Record<Round, string>> = {}
  const stale: StaleVersion[] = []
  for (const round of rounds) {
    const version = versions[String(round)]
    const current = pinned[round]
    if (
      typeof version !== 'string' ||
      !/^[0-9a-z-]{1,64}$/.test(version) ||
      current === undefined
    ) {
      return { status: 'invalid' }
    }
    linked[round] = version
    if (version !== current) stale.push({ round, linked: version, pinned: current })
  }
  return {
    status: 'valid',
    state: { versions: linked, choice: { rounds, races, areas }, sql },
    stale,
  }
}
