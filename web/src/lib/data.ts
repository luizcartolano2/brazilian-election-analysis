/** Reads the data that scripts/prepare-data.ts checked and copied into .data/. Build time only. */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { DrilldownConfig } from './drilldown/config'
import { COUNCIL, raceByCode, type Round } from './elections'
import type { Manifest } from './manifest'
import { votesWithDisplayNames, withDisplayNames, type CandidateVotes, type MapData } from './maps'
import { displayName } from './names'
import type { Summary } from './results'

const DATA_DIR = path.join(process.cwd(), '.data')

function readJson<T>(relative: string): T {
  try {
    return JSON.parse(readFileSync(path.join(DATA_DIR, relative), 'utf-8')) as T
  } catch (error) {
    throw new Error(`.data/${relative} is missing. Run npm run prepare-data first.`, {
      cause: error,
    })
  }
}

export interface DataSourceInfo {
  mode: 'published' | 'fixtures'
  /** The rounds with a data version, which .data/rounds/ holds. */
  rounds: Round[]
  /** Where the browser reads the DuckDB assets from. */
  assetBase: string
  workerScript: string
  /** The search index's folder in the static export, named for its content. */
  searchBase: string
  /** Where the browser reads the pinned boundary build, and each file's SHA-256. */
  geoBase: string
  geoSha256: Record<string, string>
}

export interface RoundSourceInfo {
  version: string | null
  /** Where the browser reads the round's data version from. */
  dataBase: string
  /** True for test fixtures that the pipeline made up rather than cut from TSE's files. */
  synthetic: boolean
}

export interface Municipality {
  municipio: number
  /** IBGE's code, which the boundaries carry. Cities abroad have none. */
  ibge: number | null
  nome: string
  capital: boolean
}

/** Reads a round's file once, and keeps it for the rest of the build. */
function cached<T>(cache: Map<string, T>, key: string, read: () => T): T {
  let value = cache.get(key)
  if (value === undefined) {
    value = read()
    cache.set(key, value)
  }
  return value
}

let source: DataSourceInfo | undefined
const manifests = new Map<string, Manifest>()
const roundSources = new Map<string, RoundSourceInfo>()
const summaries = new Map<string, Summary>()

export function getSourceInfo(): DataSourceInfo {
  source ??= readJson<DataSourceInfo>('source.json')
  return source
}

/** Whether this build holds a data version for the round. Round 2 has none before its pin. */
export function hasRound(round: Round): boolean {
  return getSourceInfo().rounds.includes(round)
}

export function getManifest(round: Round = 1): Manifest {
  return cached(manifests, String(round), () => readJson<Manifest>(`rounds/${round}/manifest.json`))
}

export function getRoundSource(round: Round = 1): RoundSourceInfo {
  return cached(roundSources, String(round), () =>
    readJson<RoundSourceInfo>(`rounds/${round}/source.json`),
  )
}

/** `area` is `br`, a state code or `zz`, in lower case. Candidates' names come in title case. */
export function getSummary(area: string, round: Round = 1): Summary {
  return cached(summaries, `${round}/${area}`, () => {
    const read = readJson<Summary>(`rounds/${round}/resumo/${area}.json`)
    return {
      ...read,
      corridas: read.corridas.map((race) => ({
        ...race,
        candidatos: race.candidatos.map((candidate) => ({
          ...candidate,
          nome: displayName(candidate.nome),
        })),
      })),
    }
  })
}

/** The state codes and `zz` that the round's data version covers, in lower case. */
export function coveredAreas(round: Round = 1): string[] {
  return getManifest(round).estados.map((code) => code.toLowerCase())
}

const municipalities = new Map<string, Record<string, Municipality[]>>()

/** An area's municipalities, or its cities abroad, in TSE's order of names, with names in title case. */
export function getMunicipalities(area: string, round: Round = 1): Municipality[] {
  const byArea = cached(municipalities, String(round), () =>
    Object.fromEntries(
      Object.entries(
        readJson<Record<string, Municipality[]>>(`rounds/${round}/municipios.json`),
      ).map(([code, list]) => [
        code,
        list.map((entry) => ({ ...entry, nome: displayName(entry.nome) })),
      ]),
    ),
  )
  return byArea[area] ?? []
}

const maps = new Map<string, MapData>()

/** A race's values by municipality: `br` holds the President map of Brazil. */
export function getRaceMap(area: string, race: number, round: Round = 1): MapData {
  const key = `${area}/${race}`
  return cached(maps, `${round}/${key}`, () =>
    withDisplayNames(
      readJson<MapData>(`rounds/${round}/mapas/${key}.json`),
      raceByCode(race)?.proportional ?? true,
    ),
  )
}

const votes = new Map<string, CandidateVotes>()

/** Each candidate's votes by municipality in a race: `br` holds President for Brazil. */
export function getCandidateVotes(area: string, race: number, round: Round = 1): CandidateVotes {
  const key = `${area}/${race}-votos`
  return cached(votes, `${round}/${key}`, () =>
    votesWithDisplayNames(readJson<CandidateVotes>(`rounds/${round}/mapas/${key}.json`)),
  )
}

/** What the browser needs to query the round's data version, with each area's races and shapes. */
export function getDrilldownConfig(round: Round = 1): DrilldownConfig {
  const source = getSourceInfo()
  const areaRaces: DrilldownConfig['areaRaces'] = {}
  const shapes: DrilldownConfig['shapes'] = {}
  for (const area of coveredAreas(round)) {
    const races = getSummary(area, round).corridas
    areaRaces[area] = races.map((race) => race.cargo)
    shapes[area] = Object.fromEntries(
      races.map((race) => [
        race.cargo,
        { seats: race.vagas, choicesPerVoter: race.escolhas_por_eleitor },
      ]),
    )
  }
  const councilArea = shapes[COUNCIL.area]
  if (round === COUNCIL.round && councilArea !== undefined) {
    councilArea[COUNCIL.race] = { seats: COUNCIL.seats, choicesPerVoter: COUNCIL.choicesPerVoter }
  }
  return {
    round,
    dataBase: getRoundSource(round).dataBase,
    assetBase: source.assetBase,
    workerScript: source.workerScript,
    areaRaces,
    shapes,
  }
}
