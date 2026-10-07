/** DuckDB-WASM's Node build, for the data step and the query tests. Never shipped to browsers. */
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { Run } from '../src/lib/drilldown/queries'
import { PARQUET_EXTENSION, packageFile, parquetExtension } from './duckdb-assets'

const require = createRequire(import.meta.url)

/** Serves the extension folder from a child process until the extension is loaded. */
async function withExtensionRepository<T>(load: (repository: string) => T): Promise<T> {
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
    return load(`http://127.0.0.1:${port}`)
  } finally {
    child.kill()
  }
}

export async function nodeRunner(): Promise<Run> {
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
        .map((row: { toJSON(): Record<string, unknown> }) => row.toJSON())
    } finally {
      statement.close()
    }
  }
}
