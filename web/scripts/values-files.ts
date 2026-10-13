/**
 * Writes the map values that the browser loads from a file: each round's Brazil map, and each
 * race's votes by municipality for the share maps. Each file is named by its content.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ValuesFile } from '../src/lib/data'
import type { Round } from '../src/lib/elections'
import {
  isMappedArea,
  votesWithDisplayNames,
  withDisplayNames,
  type CandidateVotes,
  type MapData,
} from '../src/lib/maps'
import { sha256Of } from './duckdb-assets'

/** Keyed as `<area>/<name>`, such as `br/1` or `pe/3-votos`. */
export type ValuesFiles = Record<string, ValuesFile>

const VOTES = /^(\d+)-votos\.json$/

/**
 * The maps that a page loads from a file: each round's Brazil map, the President share maps
 * of Brazil, and the Governor and Senate share maps of each state with a map. A state has no
 * President candidate pages, and a state with one municipality has no share map.
 */
export function loadsFromFile(area: string, name: string, municipalities: number): boolean {
  if (area === 'br') return name === '1' || name === '1-votos'
  return name !== '1-votos' && name.endsWith('-votos') && isMappedArea(area, municipalities)
}

/**
 * Copies the maps that `wanted` names from a round's `mapas/` folder into
 * `<publicDir>/mapas/t<round>/`, with municipality names in title case. The name and the pin
 * both hash the final bytes.
 */
export async function writeValuesFiles(
  mapsDir: string,
  publicDir: string,
  round: Round,
  wanted: (area: string, name: string) => boolean,
): Promise<ValuesFiles> {
  const files: ValuesFiles = {}
  for (const area of (await readdir(mapsDir)).sort()) {
    for (const file of (await readdir(path.join(mapsDir, area))).sort()) {
      if (!file.endsWith('.json') || !wanted(area, path.basename(file, '.json'))) continue
      const read = JSON.parse(await readFile(path.join(mapsDir, area, file), 'utf-8')) as unknown
      const shown = VOTES.test(file)
        ? votesWithDisplayNames(read as CandidateVotes)
        : withDisplayNames(read as MapData, false)
      const bytes = new TextEncoder().encode(JSON.stringify(shown))
      const sha256 = sha256Of(bytes)
      const name = `${path.basename(file, '.json')}.${sha256.slice(0, 16)}.json`
      const url = `/mapas/t${round}/${area}/${name}`
      await mkdir(path.join(publicDir, 'mapas', `t${round}`, area), { recursive: true })
      await writeFile(path.join(publicDir, url), bytes)
      files[`${area}/${path.basename(file, '.json')}`] = { url, sha256 }
    }
  }
  return files
}

/** The TSE codes that one round's votes file lists and the other's lacks, in order. */
export function municipalityDifference(first: CandidateVotes, second: CandidateVotes): number[] {
  const firstCodes = new Set(first.rows.map((row) => row[1]))
  const secondCodes = new Set(second.rows.map((row) => row[1]))
  return [...firstCodes.symmetricDifference(secondCodes)].sort((a, b) => a - b)
}

/**
 * The races and areas, keyed as `<area>/<race>`, whose votes files list the same
 * municipalities in both rounds, which a swing map needs. Every other pair goes to `differ`
 * with the codes that differ, so the build can print them.
 */
export async function swingRaces(
  firstMapsDir: string,
  secondMapsDir: string,
  firstFiles: ValuesFiles,
  secondFiles: ValuesFiles,
  differ: (race: string, codes: number[]) => void,
): Promise<string[]> {
  const read = async (dir: string, key: string) =>
    JSON.parse(await readFile(path.join(dir, `${key}.json`), 'utf-8')) as CandidateVotes
  const races: string[] = []
  for (const key of Object.keys(secondFiles).sort()) {
    if (!key.endsWith('-votos') || firstFiles[key] === undefined) continue
    const codes = municipalityDifference(
      await read(firstMapsDir, key),
      await read(secondMapsDir, key),
    )
    const race = key.slice(0, -'-votos'.length)
    if (codes.length === 0) races.push(race)
    else differ(race, codes)
  }
  return races
}
