import {
  AREAS,
  COUNCIL,
  PRESIDENT,
  raceByCode,
  raceBySlug,
  YEAR,
  type RaceInfo,
  type Round,
} from './elections'
import type { Locale } from './i18n'
import { localePath } from './paths'

export type Level = 'municipio' | 'zona' | 'secao'

export interface DrilldownAddress {
  level: Level
  /** A state code or `zz`, in lower case. */
  area: string
  municipality: number
  zone: number | null
  station: number | null
  race: RaceInfo
  /** The round whose data version the view reads. It comes from the page, not the query. */
  round: Round
}

const LIMITS = { municipality: 99999, zone: 9999, station: 9999 }
const AREA_CODES = new Set(AREAS.map((area) => area.code))

/** The one value of a parameter, or null when it is missing or repeated. */
function single(params: URLSearchParams, name: string): string | null {
  const values = params.getAll(name)
  return values.length === 1 ? (values[0] ?? null) : null
}

function wholeNumber(value: string | null, max: number): number | null {
  if (value === null || !/^[0-9]{1,5}$/.test(value)) return null
  const number = Number(value)
  return number >= 1 && number <= max ? number : null
}

/**
 * The races a municipality offers: its area's races, plus the council in Fernando de Noronha,
 * which has no round 2.
 */
export function racesFor(
  area: string,
  municipality: number,
  areaRaces: Record<string, number[]>,
  round: Round = 1,
): RaceInfo[] {
  const codes = [...(areaRaces[area] ?? [])]
  if (round === 1 && area === COUNCIL.area && municipality === COUNCIL.municipality) {
    codes.push(COUNCIL.race)
  }
  return codes.map((code) => raceByCode(code)).filter((race) => race !== undefined)
}

/**
 * Reads a drill-down address. Only a known area, whole numbers in range and a race that the
 * place offers pass. Anything else, including a repeated parameter, returns null, and the
 * caller shows the error state without running a query or requesting a file.
 */
export function parseAddress(
  level: Level,
  params: URLSearchParams,
  areaRaces: Record<string, number[]>,
  round: Round = 1,
): DrilldownAddress | null {
  const area = single(params, 'uf')
  if (area === null || !AREA_CODES.has(area)) return null
  const municipality = wholeNumber(single(params, 'mu'), LIMITS.municipality)
  if (municipality === null) return null

  let zone: number | null = null
  let station: number | null = null
  if (level !== 'municipio') {
    zone = wholeNumber(single(params, 'zn'), LIMITS.zone)
    if (zone === null) return null
  }
  if (level === 'secao') {
    station = wholeNumber(single(params, 'se'), LIMITS.station)
    if (station === null) return null
  } else if (params.has('se')) {
    return null
  }
  if (level === 'municipio' && params.has('zn')) return null

  const offered = racesFor(area, municipality, areaRaces, round)
  const slug = params.has('cargo') ? single(params, 'cargo') : raceByCode(PRESIDENT)?.slug
  const race = slug === null || slug === undefined ? undefined : raceBySlug(slug)
  if (race === undefined || !offered.some((entry) => entry.code === race.code)) return null

  return { level, area, municipality, zone, station, race, round }
}

/** The query string of an address, for links between views. */
export function addressQuery(address: {
  area: string
  municipality: number
  zone?: number | null
  station?: number | null
  race: RaceInfo
}): string {
  const params = new URLSearchParams({ uf: address.area, mu: String(address.municipality) })
  if (address.zone !== null && address.zone !== undefined) params.set('zn', String(address.zone))
  if (address.station !== null && address.station !== undefined) {
    params.set('se', String(address.station))
  }
  params.set('cargo', address.race.slug)
  return `?${params.toString()}`
}

/** A municipality's view on one race, in a locale. */
export function municipalityHref(
  locale: Locale,
  area: string,
  municipality: number,
  race: RaceInfo,
): string {
  return `${localePath(locale, `/${YEAR}/municipio/`)}${addressQuery({ area, municipality, race })}`
}
