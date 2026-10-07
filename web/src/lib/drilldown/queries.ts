import type { DrilldownAddress } from '../address'
import { PRESIDENT } from '../elections'
import { raceResults, type RaceResults } from '../results'
import { FILES } from './files'
import {
  raceFromRows,
  type CandidateInfo,
  type RaceShape,
  type Turnout,
  type VoteRow,
} from './model'

/** Runs one prepared statement. Every value, file URLs included, is a bound parameter. */
export type Run = (sql: string, params: (string | number)[]) => Promise<Record<string, unknown>[]>

/** Turns a path inside the data version into a URL the engine can read. */
export type Locate = (relativePath: string) => string

// The SQL text is constant. Nothing from the address or the search box is ever part of it.
const SQL = {
  municipality: 'SELECT nome FROM read_parquet(?) WHERE municipio = ? AND uf = ?',
  // A substitution can leave two candidacies on one number. Only the one TSE classified has a
  // destination, and the pipeline allows one such row per number.
  candidates:
    'SELECT numero, nome_urna, partido_numero, partido_sigla, resultado FROM read_parquet(?) ' +
    'WHERE cargo = ? AND uf = ? AND destino IS NOT NULL',
  municipalityVotes:
    'SELECT tipo, numero, sum(votos)::INTEGER AS votos FROM read_parquet(?) ' +
    'WHERE municipio = ? GROUP BY tipo, numero',
  zoneVotes:
    'SELECT tipo, numero, sum(votos)::INTEGER AS votos FROM read_parquet(?) ' +
    'WHERE municipio = ? AND zona = ? GROUP BY tipo, numero',
  stationVotes:
    'SELECT tipo, numero, sum(votos)::INTEGER AS votos FROM read_parquet(?) ' +
    'WHERE municipio = ? AND zona = ? AND secao = ? GROUP BY tipo, numero',
  municipalityTurnout:
    'SELECT sum(aptos)::INTEGER AS aptos, sum(comparecimento)::INTEGER AS comparecimento, ' +
    'sum(abstencoes)::INTEGER AS abstencoes, count(*)::INTEGER AS linhas FROM read_parquet(?) ' +
    'WHERE municipio = ? AND cargo = ?',
  zoneTurnout:
    'SELECT sum(aptos)::INTEGER AS aptos, sum(comparecimento)::INTEGER AS comparecimento, ' +
    'sum(abstencoes)::INTEGER AS abstencoes, count(*)::INTEGER AS linhas FROM read_parquet(?) ' +
    'WHERE municipio = ? AND zona = ? AND cargo = ?',
  stationTurnout:
    'SELECT sum(aptos)::INTEGER AS aptos, sum(comparecimento)::INTEGER AS comparecimento, ' +
    'sum(abstencoes)::INTEGER AS abstencoes, count(*)::INTEGER AS linhas FROM read_parquet(?) ' +
    'WHERE municipio = ? AND zona = ? AND secao = ? AND cargo = ?',
  zones:
    'SELECT zona::INTEGER AS zona, sum(aptos)::INTEGER AS aptos FROM read_parquet(?) ' +
    'WHERE municipio = ? AND cargo = ? GROUP BY zona ORDER BY zona',
  stations:
    'SELECT secao::INTEGER AS secao, nome_local, agregada FROM read_parquet(?) ' +
    'WHERE municipio = ? AND zona = ? ORDER BY secao',
  station:
    'SELECT nome_local, endereco, bairro, agregada, secao_principal::INTEGER AS secao_principal ' +
    'FROM read_parquet(?) WHERE municipio = ? AND zona = ? AND secao = ?',
  // contains() matches text as text, so quotes, % and _ in the search box are only letters.
  places:
    'SELECT zona::INTEGER AS zona, local_votacao::INTEGER AS local_votacao, nome_local, ' +
    'endereco, bairro, secao::INTEGER AS secao, agregada FROM read_parquet(?) ' +
    'WHERE municipio = ? AND (contains(strip_accents(lower(nome_local)), strip_accents(lower(?))) ' +
    'OR contains(strip_accents(lower(endereco)), strip_accents(lower(?))) ' +
    'OR contains(strip_accents(lower(bairro)), strip_accents(lower(?)))) ' +
    'ORDER BY nome_local, zona, local_votacao, secao LIMIT ?',
}

export class NotFound extends Error {}

export interface ZoneLink {
  zone: number
  eligible: number
}

export interface StationLink {
  station: number
  place: string
  aggregated: boolean
}

export interface StationInfo {
  place: string
  address: string
  neighborhood: string
  aggregated: boolean
  principal: number | null
}

export interface ViewData {
  municipalityName: string
  /** Null for an aggregated station, whose votes TSE counts in its principal station. */
  results: RaceResults | null
  zones: ZoneLink[]
  stations: StationLink[]
  station: StationInfo | null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function turnoutOf(run: Run, sql: string, params: (string | number)[]): Promise<Turnout> {
  const [row] = await run(sql, params)
  if (row === undefined || row.linhas === 0)
    throw new NotFound('no turnout for this place and race')
  return {
    aptos: Number(row.aptos),
    comparecimento: Number(row.comparecimento),
    abstencoes: Number(row.abstencoes),
  }
}

async function candidatesOf(run: Run, locate: Locate, address: DrilldownAddress) {
  const area = address.race.code === PRESIDENT ? 'BR' : address.area.toUpperCase()
  const rows = await run(SQL.candidates, [locate(FILES.candidates()), address.race.code, area])
  return rows as unknown as CandidateInfo[]
}

/** Loads one view: the place's name, its results for the race, and the places one level down. */
export async function loadView(
  run: Run,
  locate: Locate,
  address: DrilldownAddress,
  shape: RaceShape,
): Promise<ViewData> {
  const { area, municipality, zone, station, race } = address
  const [named] = await run(SQL.municipality, [
    locate(FILES.municipalities()),
    municipality,
    area.toUpperCase(),
  ])
  if (named === undefined) throw new NotFound('no such municipality in this state')
  const view: ViewData = {
    municipalityName: text(named.nome),
    results: null,
    zones: [],
    stations: [],
    station: null,
  }

  let rows: VoteRow[]
  let turnout: Turnout
  if (address.level === 'municipio') {
    turnout = await turnoutOf(run, SQL.municipalityTurnout, [
      locate(FILES.municipalityTurnout(area)),
      municipality,
      race.code,
    ])
    rows = (await run(SQL.municipalityVotes, [
      locate(FILES.municipalityVotes(race.code, area)),
      municipality,
    ])) as unknown as VoteRow[]
    view.zones = (
      await run(SQL.zones, [locate(FILES.zoneTurnout(area)), municipality, race.code])
    ).map((row) => ({ zone: Number(row.zona), eligible: Number(row.aptos) }))
  } else if (address.level === 'zona') {
    turnout = await turnoutOf(run, SQL.zoneTurnout, [
      locate(FILES.zoneTurnout(area)),
      municipality,
      zone as number,
      race.code,
    ])
    rows = (await run(SQL.zoneVotes, [
      locate(FILES.zoneVotes(race.code, area)),
      municipality,
      zone as number,
    ])) as unknown as VoteRow[]
    view.stations = (
      await run(SQL.stations, [locate(FILES.places(area)), municipality, zone as number])
    ).map((row) => ({
      station: Number(row.secao),
      place: text(row.nome_local),
      aggregated: row.agregada === true,
    }))
  } else {
    const [found] = await run(SQL.station, [
      locate(FILES.places(area)),
      municipality,
      zone as number,
      station as number,
    ])
    if (found === undefined) throw new NotFound('no such polling station')
    const principal = Number(found.secao_principal)
    view.station = {
      place: text(found.nome_local),
      address: text(found.endereco),
      neighborhood: text(found.bairro),
      aggregated: found.agregada === true,
      principal: principal > 0 ? principal : null,
    }
    if (view.station.aggregated) return view
    turnout = await turnoutOf(run, SQL.stationTurnout, [
      locate(FILES.stationTurnout(area)),
      municipality,
      zone as number,
      station as number,
      race.code,
    ])
    rows = (await run(SQL.stationVotes, [
      locate(FILES.stationVotes(race.code, area)),
      municipality,
      zone as number,
      station as number,
    ])) as unknown as VoteRow[]
  }

  const candidates = await candidatesOf(run, locate, address)
  view.results = raceResults(
    raceFromRows(race, shape, rows, candidates, turnout),
    race.proportional,
  )
  return view
}

export interface PlaceMatch {
  zone: number
  place: string
  address: string
  neighborhood: string
  stations: { station: number; aggregated: boolean }[]
}

const SEARCH_ROWS = 400

/**
 * Polling places in a municipality whose name, address or neighborhood contains the text.
 * Past SEARCH_ROWS stations the result is cut at a whole place and marked as truncated.
 */
export async function searchPlaces(
  run: Run,
  locate: Locate,
  area: string,
  municipality: number,
  search: string,
): Promise<{ places: PlaceMatch[]; truncated: boolean }> {
  const term = search.trim().slice(0, 100)
  if (term === '') return { places: [], truncated: false }
  const rows = await run(SQL.places, [
    locate(FILES.places(area)),
    municipality,
    term,
    term,
    term,
    SEARCH_ROWS + 1,
  ])
  const placeKey = (row: Record<string, unknown>) => `${row.zona}/${row.local_votacao}`
  const truncated = rows.length > SEARCH_ROWS
  const cut = truncated ? placeKey(rows[SEARCH_ROWS] as Record<string, unknown>) : null
  const places = new Map<string, PlaceMatch>()
  for (const row of rows.slice(0, SEARCH_ROWS)) {
    const key = placeKey(row)
    if (key === cut) continue
    let place = places.get(key)
    if (place === undefined) {
      place = {
        zone: Number(row.zona),
        place: text(row.nome_local),
        address: text(row.endereco),
        neighborhood: text(row.bairro),
        stations: [],
      }
      places.set(key, place)
    }
    place.stations.push({ station: Number(row.secao), aggregated: row.agregada === true })
  }
  return { places: [...places.values()], truncated }
}
