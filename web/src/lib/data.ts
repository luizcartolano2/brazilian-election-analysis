/** Reads the data that scripts/prepare-data.ts checked and copied into .data/. Build time only. */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Manifest } from './manifest'
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

/** `area` is `br`, a state code or `zz`, in lower case. */
export function getSummary(area: string): Summary {
  let summary = summaries.get(area)
  if (summary === undefined) {
    summary = readJson<Summary>(`resumo/${area}.json`)
    summaries.set(area, summary)
  }
  return summary
}

/** The state codes and `zz` that this data version covers, in lower case. */
export function coveredAreas(): string[] {
  return getManifest().estados.map((code) => code.toLowerCase())
}
