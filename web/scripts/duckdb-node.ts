/** DuckDB-WASM's Node build, for the data step and the query tests. Never shipped to browsers. */
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { Run } from '../src/lib/drilldown/queries'
import { PARQUET_EXTENSION, packageFile, parquetExtension } from './duckdb-assets'

const require = createRequire(import.meta.url)

/** Serves the extension folder from a child process until `load` finishes. */
export async function withExtensionRepository<T>(
  load: (repository: string) => T | Promise<T>,
): Promise<T> {
  const extension = await parquetExtension()
  const repository = path.resolve(path.dirname(extension), '..', '..')
  const child = spawn(process.execPath, [
    path.join(import.meta.dirname, 'static-dir.mjs'),
    repository,
  ])
  try {
    const port = await Promise.race([
      once(child.stdout, 'data').then(([chunk]) => String(chunk).trim()),
      once(child, 'exit').then(() => {
        throw new Error('the extension server exited before it started')
      }),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('the extension server did not start in 10 s')),
          10_000,
        ).unref()
      }),
    ])
    return await load(`http://127.0.0.1:${port}`)
  } finally {
    child.kill()
  }
}

/** The parts of DuckDB-WASM's blocking build that the data step and the tests use. */
export interface NodeDuckDB {
  open(config: { query?: { castBigIntToDouble?: boolean; castDecimalToDouble?: boolean } }): void
  connect(): NodeConnection
  registerFileBuffer(name: string, buffer: Uint8Array): void
}

export interface NodeConnection {
  query(sql: string): { toArray(): { toJSON(): Record<string, unknown> }[] }
  prepare(sql: string): {
    query(...params: unknown[]): { toArray(): { toJSON(): Record<string, unknown> }[] }
    close(): void
  }
  close(): void
}

/** An instantiated database with no extension loaded. */
export async function nodeDuckDB(): Promise<NodeDuckDB> {
  const duckdb = require('@duckdb/duckdb-wasm/blocking')
  const dist = path.dirname(packageFile('duckdb-eh.wasm'))
  const db = await duckdb.createDuckDB(
    {
      mvp: { mainModule: path.join(dist, 'duckdb-mvp.wasm'), mainWorker: '' },
      eh: { mainModule: path.join(dist, 'duckdb-eh.wasm'), mainWorker: '' },
    },
    new duckdb.VoidLogger(),
    duckdb.NODE_RUNTIME,
  )
  await db.instantiate()
  return db as NodeDuckDB
}

export async function nodeRunner(): Promise<Run> {
  const db = await nodeDuckDB()
  const connection = db.connect()
  const [version] = connection.query('SELECT version() AS v').toArray()
  if (version?.toJSON().v !== PARQUET_EXTENSION.duckdb) {
    throw new Error(
      `DuckDB-WASM runs DuckDB ${version?.toJSON().v}, but the Parquet extension is pinned for ${PARQUET_EXTENSION.duckdb}`,
    )
  }
  connection.query('SET autoload_known_extensions = false')
  await withExtensionRepository((repository) => {
    connection.query(`SET custom_extension_repository = '${repository}'`)
    connection.query('LOAD parquet')
  })
  return async (sql, params) => {
    const statement = connection.prepare(sql)
    try {
      return statement
        .query(...params)
        .toArray()
        .map((row) => row.toJSON())
    } finally {
      statement.close()
    }
  }
}
