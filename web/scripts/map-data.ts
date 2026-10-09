/**
 * Builds each mapped race's values from the pinned municipality totals, after checking that
 * they add up to the summaries and that every municipality has a boundary.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { Municipality } from '../src/lib/data'
import type { Run } from '../src/lib/drilldown/queries'
import {
  ABROAD,
  CANDIDATE_PAGE_RACES,
  PRESIDENT,
  raceByCode,
  YEAR,
  type Round,
} from '../src/lib/elections'
import { verifyFile, type Manifest } from '../src/lib/manifest'
import {
  checkRaceSums,
  CANDIDATE,
  mapRows,
  raceUnits,
  type CandidateVotes,
  type MapData,
  type UnitVotes,
  type VoteTotal,
} from '../src/lib/maps'
import { sha256Of } from './duckdb-assets'
import { LAGOONS } from './geo-assets'
import type { DataSource } from './prepare-data'
import type { Summary, SummaryRace } from '../src/lib/results'

function candidatesPath(round: Round): string {
  return `${YEAR}/t${round}/candidatos.parquet`
}

function totalsPath(round: Round, area: string, cargo: number): string {
  return `${YEAR}/t${round}/totais/municipio/cargo=${cargo}/uf=${area.toUpperCase()}.parquet`
}

/** Fails unless every pinned boundary file arrives with its pinned SHA-256. */
export async function readBoundaries(
  read: (name: string) => Promise<Uint8Array | null>,
  pins: Record<string, string>,
): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>()
  const problems: string[] = []
  for (const [name, expected] of Object.entries(pins)) {
    const bytes = await read(name)
    if (bytes === null) {
      problems.push(`the boundary file ${name} is missing`)
    } else if (sha256Of(bytes) !== expected) {
      problems.push(`the boundary file ${name} has SHA-256 ${sha256Of(bytes)}, not ${expected}`)
    } else {
      files.set(name, bytes)
    }
  }
  if (problems.length > 0) throw new Error(problems.join('. '))
  return files
}

/** The IBGE codes that a boundary file holds. */
export function boundaryIds(bytes: Uint8Array): Set<number> {
  const topology = JSON.parse(new TextDecoder().decode(bytes)) as {
    objects: { municipios: { geometries: { id: number }[] } }
  }
  return new Set(topology.objects.municipios.geometries.map((geometry) => geometry.id))
}

/**
 * Joins a boundary file with the data's municipalities, both ways: each municipality needs an
 * IBGE code and an area, and each area a municipality, unless it is one of IBGE's lagoons.
 */
export function checkBoundaries(
  file: string,
  municipalities: Municipality[],
  ids: Set<number>,
  lagoons: number[] = LAGOONS,
): string[] {
  const problems = municipalities
    .filter((municipality) => municipality.ibge === null || !ids.has(municipality.ibge))
    .map((municipality) =>
      municipality.ibge === null
        ? `${file}: ${municipality.nome} (${municipality.municipio}) has no IBGE code`
        : `${file}: ${municipality.nome} (${municipality.ibge}) has no area`,
    )
  const codes = new Set(municipalities.map((municipality) => municipality.ibge))
  for (const id of ids) {
    if (!codes.has(id) && !lagoons.includes(id)) {
      problems.push(`${file}: the area ${id} belongs to no municipality in the data`)
    }
  }
  return problems
}

interface MapInputs {
  round: Round
  /** Round 1's summaries in a round-2 build, whose ranking colors round 2's maps. */
  colorSummaries?: Map<string, Summary>
  run: Run
  source: DataSource
  manifest: Manifest
  summaries: Map<string, Summary>
  municipalities: Record<string, Municipality[]>
  boundaries: Map<string, Uint8Array>
  out: string
}

async function federationsByRace(
  run: Run,
  file: string,
): Promise<Map<string, Map<string, string>>> {
  const rows = await run(
    'SELECT DISTINCT lower(uf) AS area, cargo, partido_sigla, federacao FROM read_parquet(?) WHERE federacao IS NOT NULL',
    [file],
  )
  const byRace = new Map<string, Map<string, string>>()
  for (const row of rows) {
    const key = `${String(row.area)}:${Number(row.cargo)}`
    const parties = byRace.get(key) ?? new Map<string, string>()
    parties.set(String(row.partido_sigla), String(row.federacao))
    byRace.set(key, parties)
  }
  return byRace
}

/** Each candidate's votes in each mapped municipality, in the order of `numbers`. */
function candidateVotes(
  numbers: number[],
  rows: Record<string, unknown>[],
  municipalities: Municipality[],
  valid: Map<number, number>,
): CandidateVotes {
  const column = new Map(numbers.map((numero, index) => [numero, index]))
  const byMunicipality = new Map<number, number[]>()
  for (const row of rows) {
    const index = column.get(Number(row.numero))
    if (index === undefined) continue
    const counts = byMunicipality.get(Number(row.municipio)) ?? numbers.map(() => 0)
    counts[index] = Number(row.votos)
    byMunicipality.set(Number(row.municipio), counts)
  }
  return {
    numbers,
    rows: municipalities.flatMap((municipality) =>
      municipality.ibge === null
        ? []
        : [
            [
              municipality.ibge,
              municipality.municipio,
              municipality.nome,
              valid.get(municipality.municipio) ?? 0,
              ...(byMunicipality.get(municipality.municipio) ?? numbers.map(() => 0)),
            ],
          ],
    ),
  }
}

/** Every race file is checked against the manifest, then read from a temporary copy. */
async function localCopy(inputs: MapInputs, folder: string, relative: string): Promise<string> {
  const bytes = await inputs.source.read(relative)
  verifyFile(inputs.manifest, relative, bytes)
  const file = path.join(folder, relative.replaceAll('/', '_'))
  await writeFile(file, bytes as Uint8Array)
  return file
}

/** Copies the files a few at a time, since each one is a round trip to the Worker. */
async function localCopies(
  inputs: MapInputs,
  folder: string,
  relatives: string[],
): Promise<Map<string, string>> {
  const copies = new Map<string, string>()
  let next = 0
  const worker = async () => {
    while (next < relatives.length) {
      const relative = relatives[next++] as string
      copies.set(relative, await localCopy(inputs, folder, relative))
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  return copies
}

function raceOf(summary: Summary | undefined, cargo: number): SummaryRace | undefined {
  return summary?.corridas.find((race) => race.cargo === cargo)
}

/**
 * The race whose ranking colors a race's map: Brazil's for President, so a candidate keeps one
 * color on every map. With `colorSummaries`, round 1's race ranks round 2's finalists, so each
 * keeps its round-1 color.
 */
export function colorRaceOf(
  race: SummaryRace,
  area: string,
  summaries: Map<string, Summary>,
  colorSummaries?: Map<string, Summary>,
): SummaryRace {
  const colorArea = race.cargo === PRESIDENT ? 'br' : area
  const color = raceOf((colorSummaries ?? summaries).get(colorArea), race.cargo)
  if (color === undefined) throw new Error(`${colorArea}.json has no race ${race.cargo} to rank`)
  if (colorSummaries === undefined) return color
  const finalists = new Set(race.candidatos.map((candidate) => candidate.numero))
  return {
    ...color,
    candidatos: color.candidatos.filter((candidate) => finalists.has(candidate.numero)),
  }
}

/**
 * Writes `<out>/<area>/<cargo>.json` for each state's races and `<out>/br/1.json` for the
 * President map of Brazil. Any difference from a summary, or a municipality without a
 * boundary, fails after every race was checked, with every difference listed.
 */
export async function buildMaps(inputs: MapInputs): Promise<void> {
  const { round, run, summaries, municipalities, boundaries, out } = inputs
  const candidates = candidatesPath(round)
  const brazilRace = raceOf(summaries.get('br'), PRESIDENT)
  if (brazilRace === undefined) throw new Error('br.json has no President race')
  const folder = await mkdtemp(path.join(os.tmpdir(), 'mapas-'))
  const problems: string[] = []
  const brazilTotals: VoteTotal[] = []
  const brazilRows: MapData['rows'] = []
  let brazilUnits: string[] = []
  const brazilVotes: CandidateVotes = { numbers: [], rows: [] }
  try {
    const areas = [...summaries]
      .filter(([area]) => area !== 'br')
      .sort(([a], [b]) => a.localeCompare(b))
    const copies = await localCopies(inputs, folder, [
      candidates,
      ...areas.flatMap(([area, summary]) =>
        summary.corridas.map((race) => totalsPath(round, area, race.cargo)),
      ),
    ])
    const copyOf = (relative: string) => copies.get(relative) as string
    const federations = await federationsByRace(run, copyOf(candidates))
    for (const [area, summary] of areas) {
      if (area !== ABROAD.code) {
        const ids = boundaries.get(`${area}.json`)
        if (ids === undefined) problems.push(`the pinned boundary build has no ${area}.json`)
        else
          problems.push(
            ...checkBoundaries(`${area}.json`, municipalities[area] ?? [], boundaryIds(ids)),
          )
      }
      for (const race of summary.corridas) {
        const info = raceByCode(race.cargo)
        if (info === undefined) throw new Error(`${area}.json holds race ${race.cargo}`)
        const where = `${area} ${info.slug}`
        const file = copyOf(totalsPath(round, area, race.cargo))
        const totals = (
          await run(
            'SELECT tipo, numero, sum(votos)::DOUBLE AS votos FROM read_parquet(?) GROUP BY ALL',
            [file],
          )
        ).map((row) => ({
          tipo: Number(row.tipo),
          numero: Number(row.numero),
          votos: Number(row.votos),
        }))
        problems.push(...checkRaceSums(where, race, info.proportional, totals))
        if (race.cargo === PRESIDENT) brazilTotals.push(...totals)
        if (area === ABROAD.code) {
          await rm(file)
          continue
        }

        const units = raceUnits(
          race,
          info.proportional,
          federations.get(`${area}:${race.cargo}`) ?? new Map(),
          colorRaceOf(race, area, summaries, inputs.colorSummaries),
        )
        // Units are whole numbers, so the mapping goes into the query as literals. A race with
        // no valid unit gets one row that matches no vote, so the query stays valid.
        const values = (units.mapping.length > 0 ? units.mapping : [[-1, -1, -1]]).map(
          ([tipo, numero, unit]) => `(${tipo}, ${numero}, ${unit})`,
        )
        const unitVotes = (
          await run(
            `WITH units(tipo, numero, unit) AS (VALUES ${values.join(', ')})
             SELECT v.municipio, u.unit, sum(v.votos)::DOUBLE AS votos
             FROM read_parquet(?) v JOIN units u USING (tipo, numero) GROUP BY ALL`,
            [file],
          )
        ).map((row): UnitVotes => ({
          municipio: Number(row.municipio),
          unit: Number(row.unit),
          votos: Number(row.votos),
        }))
        const unmapped = await run(
          `WITH units(tipo, numero, unit) AS (VALUES ${values.join(', ')})
           SELECT v.tipo, v.numero, sum(v.votos)::DOUBLE AS votos FROM read_parquet(?) v
           ANTI JOIN units u USING (tipo, numero) WHERE v.tipo IN (1, 2) GROUP BY ALL`,
          [file],
        )
        for (const row of unmapped) {
          problems.push(
            `${where}: ${Number(row.votos)} valid votes for number ${Number(row.numero)} belong to no candidate or party in the summary`,
          )
        }
        const valid = new Map(
          (
            await run(
              'SELECT municipio, sum(votos) FILTER (WHERE tipo IN (1, 2))::DOUBLE AS valid FROM read_parquet(?) GROUP BY ALL',
              [file],
            )
          ).map((row) => [Number(row.municipio), Number(row.valid)]),
        )

        const list = municipalities[area] ?? []
        if (CANDIDATE_PAGE_RACES.has(race.cargo)) {
          const votes = candidateVotes(
            units.mapping.map(([, numero]) => numero),
            await run(
              `SELECT municipio, numero, sum(votos)::DOUBLE AS votos FROM read_parquet(?)
               WHERE tipo = ${CANDIDATE} GROUP BY ALL`,
              [file],
            ),
            list,
            valid,
          )
          await mkdir(path.join(out, area), { recursive: true })
          await writeFile(path.join(out, area, `${race.cargo}-votos.json`), JSON.stringify(votes))
          if (race.cargo === PRESIDENT) {
            brazilVotes.numbers = votes.numbers
            brazilVotes.rows.push(...votes.rows)
          }
        }
        await rm(file)
        // The map draws the list, so votes for a municipality outside it would vanish from it.
        const known = new Set(list.map((municipality) => municipality.municipio))
        for (const code of valid.keys()) {
          if (!known.has(code)) {
            problems.push(
              `${where}: the totals hold municipality ${code}, which the municipality list lacks`,
            )
          }
        }
        const mapped = list.flatMap((municipality) =>
          municipality.ibge === null ? [] : [{ ...municipality, ibge: municipality.ibge }],
        )
        const data: MapData = {
          kind: units.kind,
          units: units.units,
          rows: mapRows(mapped, unitVotes, valid),
        }
        await mkdir(path.join(out, area), { recursive: true })
        await writeFile(path.join(out, area, `${race.cargo}.json`), JSON.stringify(data))
        if (race.cargo === PRESIDENT) {
          brazilUnits = units.units
          brazilRows.push(...data.rows)
        }
      }
    }
    // Brazil's summary counts the cities abroad, so its check does too.
    problems.push(...checkRaceSums('br presidente', brazilRace, false, brazilTotals))
    const brazilIds = boundaries.get('br.json')
    const inStates = areas
      .filter(([area]) => area !== ABROAD.code)
      .flatMap(([area]) => municipalities[area] ?? [])
    if (brazilIds === undefined) problems.push('the pinned boundary build has no br.json')
    else problems.push(...checkBoundaries('br.json', inStates, boundaryIds(brazilIds)))
    await mkdir(path.join(out, 'br'), { recursive: true })
    const brazil: MapData = { kind: 'margin', units: brazilUnits, rows: brazilRows }
    await writeFile(path.join(out, 'br', `${PRESIDENT}.json`), JSON.stringify(brazil))
    await writeFile(path.join(out, 'br', `${PRESIDENT}-votos.json`), JSON.stringify(brazilVotes))
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
  if (problems.length > 0) {
    throw new Error(`the municipality totals do not match the summaries:\n${problems.join('\n')}`)
  }
}
