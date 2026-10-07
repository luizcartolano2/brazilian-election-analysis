/**
 * The files DuckDB-WASM loads at run time besides the page: its WebAssembly module, from the
 * locked npm package, and DuckDB's signed Parquet extension, pinned by SHA-256.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const WEB_ROOT = path.resolve(import.meta.dirname, '..')

/** DuckDB-WASM reads Parquet only through this extension, which it fetches on LOAD. */
export const PARQUET_EXTENSION = {
  duckdb: 'v1.5.4',
  platform: 'wasm_eh',
  file: 'parquet.duckdb_extension.wasm',
  sha256: '4845705bbd69fc9ad52878d96a505c73cae4a6c509822079cc2413e5eb437f95',
} as const

export const EXTENSION_PATH = `extensions/${PARQUET_EXTENSION.duckdb}/${PARQUET_EXTENSION.platform}/${PARQUET_EXTENSION.file}`
const EXTENSION_SOURCE = `https://extensions.duckdb.org/${PARQUET_EXTENSION.duckdb}/${PARQUET_EXTENSION.platform}/${PARQUET_EXTENSION.file}`

export function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function packageFile(name: string): string {
  return require.resolve(`@duckdb/duckdb-wasm/dist/${name}`)
}

/** The installed package's version. Its export map hides package.json from require. */
export function duckdbPackageVersion(): string {
  const manifest = path.join(path.dirname(packageFile('duckdb-eh.wasm')), '..', 'package.json')
  return (JSON.parse(readFileSync(manifest, 'utf-8')) as { version: string }).version
}

/** The extension's local copy, downloaded once and checked against its pinned SHA-256. */
export async function parquetExtension(cacheDir = path.join(WEB_ROOT, '.cache')): Promise<string> {
  const target = path.join(cacheDir, EXTENSION_PATH)
  try {
    if (sha256Of(await readFile(target)) === PARQUET_EXTENSION.sha256) return target
  } catch {
    // Not downloaded yet.
  }
  const response = await fetch(EXTENSION_SOURCE, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`${EXTENSION_SOURCE}: HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const actual = sha256Of(bytes)
  if (actual !== PARQUET_EXTENSION.sha256) {
    throw new Error(
      `${EXTENSION_SOURCE} has SHA-256 ${actual}, the pin is ${PARQUET_EXTENSION.sha256}`,
    )
  }
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, bytes)
  return target
}

/** Each asset's path under assets/duckdb-wasm/<package version>/, and its local source. */
export async function assetFiles(): Promise<{ path: string; source: string }[]> {
  return [
    { path: 'duckdb-eh.wasm', source: packageFile('duckdb-eh.wasm') },
    { path: EXTENSION_PATH, source: await parquetExtension() },
  ]
}
