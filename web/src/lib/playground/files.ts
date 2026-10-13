/** The published files that the playground can read, as the build lists them for the browser. */
import type { Round } from '../elections'
import type { Manifest } from '../manifest'
import { matchPath, tableByName } from './catalog'
import { isBrazil, type DataChoice } from './choice'

export interface PlaygroundFile {
  table: string
  round: Round
  race: number | null
  area: string | null
  /** The file's path inside its data version. */
  path: string
  size: number
  sha256: string
}

/** One file as the list in the static export holds it, to keep the list small. */
export type ListedFile = [
  table: string,
  race: number | null,
  area: string | null,
  path: string,
  size: number,
  sha256: string,
]

/** Each file of a version that the catalog names for a table. Every other file stays out. */
export function playgroundFiles(manifest: Manifest, round: Round): PlaygroundFile[] {
  return manifest.arquivos.flatMap((entry): PlaygroundFile[] => {
    const match = matchPath(entry.path, round)
    if (match === null) return []
    // Each version carries the municipality list, and the playground reads round 1's alone.
    if (tableByName(match.table)?.rows === 'round-1' && round !== 1) return []
    return [{ ...match, path: entry.path, size: entry.size, sha256: entry.sha256 }]
  })
}

export function listFiles(files: PlaygroundFile[]): ListedFile[] {
  return files.map((file) => [file.table, file.race, file.area, file.path, file.size, file.sha256])
}

export function unlistFiles(round: Round, listed: ListedFile[]): PlaygroundFile[] {
  return listed.map(([table, race, area, path, size, sha256]) => ({
    table,
    round,
    race,
    area,
    path,
    size,
    sha256,
  }))
}

/** A candidate as the form's picker lists it: number, name in title case, party. */
export type ListedCandidate = [numero: number, nome: string, partido: string]

/** Each race's candidates by area, for one round: `br` holds the President's. */
export type CandidateLists = Record<string, Record<string, ListedCandidate[]>>

/** The files of `table` that hold the chosen data. */
export function tableFiles(
  files: PlaygroundFile[],
  choice: DataChoice,
  table: string,
): PlaygroundFile[] {
  const rows = tableByName(table)?.rows
  return files.filter((file) => {
    if (file.table !== table) return false
    if (rows === 'round-1') return file.round === 1
    if (!choice.rounds.includes(file.round)) return false
    if (file.race !== null && !choice.races.includes(file.race)) return false
    if (file.area !== null && !isBrazil(choice) && !choice.areas.includes(file.area)) return false
    return true
  })
}

/** Every file of the chosen data, in every table. */
export function choiceFiles(files: PlaygroundFile[], choice: DataChoice): PlaygroundFile[] {
  const tables = new Set(files.map((file) => file.table))
  return [...tables].flatMap((table) => tableFiles(files, choice, table))
}
