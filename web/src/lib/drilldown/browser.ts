import type { AsyncDuckDB } from '@duckdb/duckdb-wasm'
import type { DrilldownConfig } from './config'
import type { Locate, Run } from './queries'

function absolute(url: string): string {
  return new URL(url, window.location.href).toString()
}

export function browserLocate(config: DrilldownConfig): Locate {
  return (relative) => absolute(`${config.dataBase}/${relative}`)
}

let runner: Promise<Run> | null = null

/** DuckDB reports progress well under a second apart while the module downloads. */
const STALL_MS = 20_000

/**
 * One DuckDB instance per page, started on first use. A failed start is forgotten, so a retry
 * starts again. Statements run one at a time.
 */
export function browserRunner(config: DrilldownConfig): Promise<Run> {
  runner ??= start(config).catch((error: unknown) => {
    runner = null
    throw error
  })
  return runner
}

/**
 * DuckDB's worker drops a failed module download without rejecting, which would leave a view
 * loading forever. So a download that stops reporting progress counts as failed.
 */
function instantiate(db: AsyncDuckDB, moduleUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let settled = false
    const settle = (outcome: () => void) => {
      settled = true
      clearTimeout(timer)
      outcome()
    }
    const restartTimer = () => {
      if (settled) return
      clearTimeout(timer)
      timer = setTimeout(
        () => settle(() => reject(new Error('the DuckDB module download stalled'))),
        STALL_MS,
      )
    }
    restartTimer()
    db.instantiate(moduleUrl, null, restartTimer).then(
      () => settle(resolve),
      (error: unknown) => settle(() => reject(error)),
    )
  })
}

async function start(config: DrilldownConfig): Promise<Run> {
  const duckdb = await import('@duckdb/duckdb-wasm')
  const worker = new Worker(absolute(config.workerScript))
  let connection: Awaited<ReturnType<InstanceType<typeof duckdb.AsyncDuckDB>['connect']>>
  try {
    const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker)
    await instantiate(db, absolute(`${config.assetBase}/duckdb-eh.wasm`))
    await db.open({ query: { castBigIntToDouble: true } })
    connection = await db.connect()
    const repository = absolute(`${config.assetBase}/extensions`)
    // The repository comes from the build, never from the address, and holds no quote.
    if (repository.includes("'")) throw new Error('the extension repository URL holds a quote')
    await connection.query('SET autoload_known_extensions = false')
    await connection.query(`SET custom_extension_repository = '${repository}'`)
    await connection.query('LOAD parquet')
  } catch (error) {
    worker.terminate()
    throw error
  }

  let queue: Promise<unknown> = Promise.resolve()
  return (sql, params) => {
    const job = queue.then(async () => {
      const statement = await connection.prepare(sql)
      try {
        const table = await statement.query(...params)
        return table.toArray().map((row) => row.toJSON() as Record<string, unknown>)
      } finally {
        await statement.close()
      }
    })
    queue = job.catch(() => undefined)
    return job
  }
}
