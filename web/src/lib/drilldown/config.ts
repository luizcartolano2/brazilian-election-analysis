import type { RaceShape } from './model'

/** Built at build time from the checked data, and handed to the browser views as props. */
export interface DrilldownConfig {
  /** The data version's root, as a URL or a path on this site. */
  dataBase: string
  /** The folder with DuckDB's WebAssembly module and its Parquet extension. */
  assetBase: string
  /** DuckDB's worker script, served from the page's own origin. */
  workerScript: string
  /** Each area's race codes. */
  areaRaces: Record<string, number[]>
  /** Each area's seats and choices per voter, by race code. */
  shapes: Record<string, Record<number, RaceShape>>
}
