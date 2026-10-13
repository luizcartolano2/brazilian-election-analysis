/** Writes the playground's file list and candidate lists into the static export. */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Run } from '../src/lib/drilldown/queries'
import type { Round } from '../src/lib/elections'
import { displayName } from '../src/lib/names'
import {
  listFiles,
  type CandidateLists,
  type ListedFile,
  type PlaygroundFile,
} from '../src/lib/playground/files'
import { sha256Of } from './duckdb-assets'

/** Where the page finds the lists, and each list's SHA-256, which the page checks. */
export interface PlaygroundInfo {
  base: string
  files: string
  /** Keyed `<round>-<race>`. */
  candidates: Record<string, string>
}

export interface PlaygroundRound {
  round: Round
  files: PlaygroundFile[]
  candidates: CandidateLists
}

/**
 * Each race's candidates by area whose votes count as valid, from the candidate file that the
 * playground exposes, because the form counts valid votes only. A substitution can leave two
 * candidacies on one number, and only the one TSE classified has a destination.
 */
export async function candidateLists(run: Run, file: string): Promise<CandidateLists> {
  const rows = await run(
    'SELECT cargo, lower(uf) AS area, numero, nome_urna, partido_sigla FROM read_parquet(?) ' +
      "WHERE destino = 'Válido' ORDER BY cargo, uf, numero",
    [file],
  )
  const lists: CandidateLists = {}
  for (const row of rows) {
    const byArea = (lists[String(row.cargo)] ??= {})
    ;(byArea[String(row.area)] ??= []).push([
      Number(row.numero),
      displayName(String(row.nome_urna)),
      row.partido_sigla === null ? '' : String(row.partido_sigla),
    ])
  }
  return lists
}

/**
 * Writes the lists under a folder named for their content, so the browser can cache them for
 * good, and returns where they are.
 */
export async function writePlaygroundData(
  publicDir: string,
  rounds: PlaygroundRound[],
): Promise<PlaygroundInfo> {
  const filesByRound: Record<string, ListedFile[]> = {}
  for (const round of rounds) filesByRound[String(round.round)] = listFiles(round.files)
  const contents = new Map<string, string>([['arquivos.json', JSON.stringify(filesByRound)]])
  for (const round of rounds) {
    for (const [race, byArea] of Object.entries(round.candidates)) {
      contents.set(`candidatos-${round.round}-${race}.json`, JSON.stringify(byArea))
    }
  }
  const names = [...contents.keys()].sort()
  const hash = sha256Of(
    new TextEncoder().encode(names.map((name) => `${name}\n${contents.get(name)}`).join('\n')),
  ).slice(0, 16)
  const root = path.join(publicDir, 'consultas')
  await rm(root, { recursive: true, force: true })
  await mkdir(path.join(root, hash), { recursive: true })
  const candidates: Record<string, string> = {}
  for (const name of names) {
    const text = contents.get(name) ?? ''
    await writeFile(path.join(root, hash, name), text)
    const key = /^candidatos-(\d)-(\d+)\.json$/.exec(name)
    if (key !== null) candidates[`${key[1]}-${key[2]}`] = sha256Of(new TextEncoder().encode(text))
  }
  return {
    base: `/consultas/${hash}`,
    files: sha256Of(new TextEncoder().encode(contents.get('arquivos.json') ?? '')),
    candidates,
  }
}
