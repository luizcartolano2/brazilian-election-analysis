import type { Round } from '../elections'

/** A run that needs more new bytes than this waits until the visitor confirms them. */
export const CONFIRM_BYTES = 25_000_000

/** What the playground page needs from the build, handed to the browser as props. */
export interface PlaygroundConfig {
  /** The folder of the build's file list and candidate lists, named for their content. */
  base: string
  filesSha256: string
  /** Each candidate list's SHA-256, keyed `<round>-<race>`. */
  candidatesSha256: Record<string, string>
  rounds: Round[]
  /** Each pinned round's data version, or `teste` in a fixtures build. */
  versions: Partial<Record<Round, string>>
  /** Where the browser reads each round's files from. */
  dataBase: Partial<Record<Round, string>>
  assetBase: string
  workerScript: string
  /** Each race that a pinned round holds, with its rounds. */
  races: { code: number; rounds: Round[] }[]
  /** The states and `zz` that round 1 covers, in lower case. */
  areas: string[]
  /** A run that needs more new bytes than this waits until the visitor confirms them. */
  confirmBytes: number
}
