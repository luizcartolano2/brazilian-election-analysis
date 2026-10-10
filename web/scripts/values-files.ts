/**
 * Writes the map values that the browser loads from a file: each round's Brazil map, and each
 * race's votes by municipality for the share maps. Each file is named by its content.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ValuesFile } from '../src/lib/data'
import type { Round } from '../src/lib/elections'
import {
  votesWithDisplayNames,
  withDisplayNames,
  type CandidateVotes,
  type MapData,
} from '../src/lib/maps'
import { sha256Of } from './duckdb-assets'

/** Keyed as `<area>/<name>`, such as `br/1` or `pe/3-votos`. */
export type ValuesFiles = Record<string, ValuesFile>

const VOTES = /^(\d+)-votos\.json$/

/** The maps whose values leave the page: Brazil's President map and every race's votes. */
function loadsFromFile(area: string, file: string): boolean {
  return VOTES.test(file) || (area === 'br' && file === '1.json')
}

/**
 * Copies those maps from a round's `mapas/` folder into `<publicDir>/mapas/t<round>/`, with
 * municipality names in title case. The name and the pin both hash the final bytes.
 */
export async function writeValuesFiles(
  mapsDir: string,
  publicDir: string,
  round: Round,
): Promise<ValuesFiles> {
  const files: ValuesFiles = {}
  for (const area of (await readdir(mapsDir)).sort()) {
    for (const file of (await readdir(path.join(mapsDir, area))).sort()) {
      if (!loadsFromFile(area, file)) continue
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
