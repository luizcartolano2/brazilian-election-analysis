/** Reads the data that scripts/prepare-data.ts checked and copied into .data/. Build time only. */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { DrilldownConfig } from './drilldown/config'
import { COUNCIL, raceByCode } from './elections'
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
  version: string | null
  /** Where the browser reads the data version and the DuckDB assets from. */
  dataBase: string
  assetBase: string
  workerScript: string
  /** The search index's folder in the static export, named for its content. */
  searchBase: string
  /** Where the browser reads the pinned boundary build, and each file's SHA-256. */
  geoBase: string
  geoSha256: Record<string, string>
}

export interface Municipality {
  municipio: number
  /** IBGE's code, which the boundaries carry. Cities abroad have none. */
  ibge: number | null
  nome: string
  capital: boolean
}

let manifest: Manifest | undefined
let source: DataSourceInfo | undefined
const summaries = new Map<string, Summary>()

export function getManifest(): Manifest {
  manifest ??= readJson<Manifest>('manifest.json')
  return manifest
}

export function getSourceInfo(): DataSourceInfo {
  source ??= readJson<DataSourceInfo>('source.json')
  return source
}

/** `area` is `br`, a state code or `zz`, in lower case. Candidates' names come in title case. */
export function getSummary(area: string): Summary {
  let summary = summaries.get(area)
  if (summary === undefined) {
    const read = readJson<Summary>(`resumo/${area}.json`)
    summary = {
      ...read,
      corridas: read.corridas.map((race) => ({
        ...race,
        candidatos: race.candidatos.map((candidate) => ({
          ...candidate,
          nome: displayName(candidate.nome),
        })),
      })),
    }
    summaries.set(area, summary)
  }
  return summary
}

/** The state codes and `zz` that this data version covers, in lower case. */
export function coveredAreas(): string[] {
  return getManifest().estados.map((code) => code.toLowerCase())
}

let municipalities: Record<string, Municipality[]> | undefined

/** An area's municipalities, or its cities abroad, in TSE's order of names, with names in title case. */
export function getMunicipalities(area: string): Municipality[] {
  municipalities ??= Object.fromEntries(
    Object.entries(readJson<Record<string, Municipality[]>>('municipios.json')).map(
      ([code, list]) => [code, list.map((entry) => ({ ...entry, nome: displayName(entry.nome) }))],
    ),
  )
  return municipalities[area] ?? []
}

const maps = new Map<string, MapData>()

/** A race's values by municipality: `br` holds the President map of Brazil. */
export function getRaceMap(area: string, race: number): MapData {
  const key = `${area}/${race}`
  let data = maps.get(key)
  if (data === undefined) {
    data = withDisplayNames(
      readJson<MapData>(`mapas/${key}.json`),
      raceByCode(race)?.proportional ?? true,
    )
    maps.set(key, data)
  }
  return data
}

const votes = new Map<string, CandidateVotes>()

/** Each candidate's votes by municipality in a race: `br` holds President for Brazil. */
export function getCandidateVotes(area: string, race: number): CandidateVotes {
  const key = `${area}/${race}-votos`
  let data = votes.get(key)
  if (data === undefined) {
    data = votesWithDisplayNames(readJson<CandidateVotes>(`mapas/${key}.json`))
    votes.set(key, data)
  }
  return data
}

/** What the browser needs to query this data version, with each area's races and shapes. */
export function getDrilldownConfig(): DrilldownConfig {
  const source = getSourceInfo()
  const areaRaces: DrilldownConfig['areaRaces'] = {}
  const shapes: DrilldownConfig['shapes'] = {}
  for (const area of coveredAreas()) {
    const races = getSummary(area).corridas
    areaRaces[area] = races.map((race) => race.cargo)
    shapes[area] = Object.fromEntries(
      races.map((race) => [
        race.cargo,
        { seats: race.vagas, choicesPerVoter: race.escolhas_por_eleitor },
      ]),
    )
  }
  const councilArea = shapes[COUNCIL.area]
  if (councilArea !== undefined) {
    councilArea[COUNCIL.race] = { seats: COUNCIL.seats, choicesPerVoter: COUNCIL.choicesPerVoter }
  }
  return {
    dataBase: source.dataBase,
    assetBase: source.assetBase,
    workerScript: source.workerScript,
    areaRaces,
    shapes,
  }
}
