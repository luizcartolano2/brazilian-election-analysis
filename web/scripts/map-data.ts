/**
 * Builds each mapped race's values from the pinned municipality totals, after checking that
 * they add up to the summaries and that every municipality has a boundary.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { Municipality } from '../src/lib/data'
import type { Run } from '../src/lib/drilldown/queries'
import { ABROAD, PRESIDENT, raceByCode, ROUND, YEAR } from '../src/lib/elections'
import { verifyFile, type Manifest } from '../src/lib/manifest'
import {
  checkRaceSums,
  mapRows,
  raceUnits,
  type MapData,
  type UnitVotes,
  type VoteTotal,
} from '../src/lib/maps'
import { sha256Of } from './duckdb-assets'
import type { DataSource } from './prepare-data'
import type { Summary, SummaryRace } from '../src/lib/results'

const CANDIDATES = `${YEAR}/t${ROUND}/candidatos.parquet`

function totalsPath(area: string, cargo: number): string {
  return `${YEAR}/t${ROUND}/totais/municipio/cargo=${cargo}/uf=${area.toUpperCase()}.parquet`
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

/** Fails on any mapped municipality with no IBGE code, or with no area in its boundary file. */
export function checkBoundaries(
  where: string,
  municipalities: Municipality[],
  ids: Set<number>,
): string[] {
  return municipalities
    .filter((municipality) => municipality.ibge === null || !ids.has(municipality.ibge))
    .map((municipality) =>
      municipality.ibge === null
        ? `${where}: ${municipality.nome} (${municipality.municipio}) has no IBGE code`
        : `${where}: ${municipality.nome} (${municipality.ibge}) has no boundary`,
    )
}

interface MapInputs {
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

/** Every race file is checked against the manifest, then read from a temporary copy. */
async function localCopy(inputs: MapInputs, folder: string, relative: string): Promise<string> {
  const bytes = await inputs.source.read(relative)
  verifyFile(inputs.manifest, relative, bytes)
  const file = path.join(folder, relative.replaceAll('/', '_'))
  await writeFile(file, bytes as Uint8Array)
  return file
}

function raceOf(summary: Summary | undefined, cargo: number): SummaryRace | undefined {
  return summary?.corridas.find((race) => race.cargo === cargo)
}

/**
 * Writes `<out>/<area>/<cargo>.json` for each state's races and `<out>/br/1.json` for the
 * President map of Brazil. Any difference from a summary, or a municipality without a
 * boundary, fails after every race was checked, with every difference listed.
 */
export async function buildMaps(inputs: MapInputs): Promise<void> {
  const { run, summaries, municipalities, boundaries, out } = inputs
  const brazilRace = raceOf(summaries.get('br'), PRESIDENT)
  if (brazilRace === undefined) throw new Error('br.json has no President race')
  const folder = await mkdtemp(path.join(os.tmpdir(), 'mapas-'))
  const problems: string[] = []
  const brazilTotals: VoteTotal[] = []
  const brazilRows: MapData['rows'] = []
  let brazilUnits: string[] = []
  try {
    const federations = await federationsByRace(run, await localCopy(inputs, folder, CANDIDATES))
    for (const [area, summary] of [...summaries].sort(([a], [b]) => a.localeCompare(b))) {
      if (area === 'br') continue
      for (const race of summary.corridas) {
        const info = raceByCode(race.cargo)
        if (info === undefined) throw new Error(`${area}.json holds race ${race.cargo}`)
        const where = `${area} ${info.slug}`
        const file = await localCopy(inputs, folder, totalsPath(area, race.cargo))
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
        if (area === ABROAD.code) continue

        const units = raceUnits(
          race,
          info.proportional,
          federations.get(`${area}:${race.cargo}`) ?? new Map(),
          race.cargo === PRESIDENT ? brazilRace : race,
        )
        // Units are whole numbers, so the mapping goes into the query as literals.
        const values = units.mapping.map(([tipo, numero, unit]) => `(${tipo}, ${numero}, ${unit})`)
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
        const ids = boundaries.get(`${area}.json`)
        if (ids === undefined) {
          problems.push(`${where}: the pinned boundary build has no ${area}.json`)
        } else {
          problems.push(...checkBoundaries(where, list, boundaryIds(ids)))
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
    await mkdir(path.join(out, 'br'), { recursive: true })
    const brazil: MapData = { kind: 'margin', units: brazilUnits, rows: brazilRows }
    await writeFile(path.join(out, 'br', `${PRESIDENT}.json`), JSON.stringify(brazil))
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
  if (problems.length > 0) {
    throw new Error(`the municipality totals do not match the summaries:\n${problems.join('\n')}`)
  }
}
