/** Plans and runs one query: the files it needs, their download and check, and its result. */
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import type { Round } from '../elections'
import { sizeOf, type DataChoice } from './choice'
import { sha256Hex } from './digest'
import {
  batchColumns,
  batchRows,
  CatalogMismatch,
  Engine,
  type Batch,
  type EngineAssets,
} from './engine'
import { tableFiles, type PlaygroundFile } from './files'
import { ResultCollector, type ResultColumn } from './result'
import type { ColumnProblem } from './sandbox'
import { scanQuery } from './tables'

const PARALLEL_DOWNLOADS = 4
/** How long a cancel waits for DuckDB before it terminates the engine. */
export const CANCEL_FALLBACK_MS = 1000

export interface RunPlan {
  statements: string[]
  /** Each table that the query names and the choice fills, with its files. */
  tables: Map<string, PlaygroundFile[]>
  /** The files that the engine does not hold yet. */
  missing: PlaygroundFile[]
  missingBytes: number
}

export function planRun(
  sql: string,
  choice: DataChoice,
  files: PlaygroundFile[],
  holds: (file: PlaygroundFile) => boolean,
): RunPlan {
  const scan = scanQuery(sql)
  const tables = new Map<string, PlaygroundFile[]>()
  for (const table of [...scan.tables].sort()) {
    const chosen = tableFiles(files, choice, table)
    if (chosen.length > 0) tables.set(table, chosen)
  }
  const missing = [...tables.values()].flat().filter((file) => !holds(file))
  return { statements: scan.statements, tables, missing, missingBytes: sizeOf(missing) }
}

export type FailureReason = 'engine' | 'download' | 'check' | 'catalog' | 'query' | 'empty'

export type RunOutcome =
  | { status: 'done'; collector: ResultCollector; seconds: number }
  | { status: 'cancelled' }
  | { status: 'failed'; reason: FailureReason; message: string; problems?: ColumnProblem[] }

export interface RunProgress {
  onDownload(received: number, total: number): void
  onQuery(): void
}

class RunFailure extends Error {
  constructor(
    readonly reason: FailureReason,
    message: string,
  ) {
    super(message)
  }
}

/** Fetches a whole file and checks it against its pinned size and SHA-256. */
async function download(
  url: string,
  file: PlaygroundFile,
  signal: AbortSignal,
  onBytes: (count: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  let response: Response
  try {
    response = await fetch(url, { signal })
  } catch (error) {
    if (signal.aborted) throw error
    throw new RunFailure('download', `${file.path}: ${String(error)}`)
  }
  if (!response.ok || response.body === null) {
    throw new RunFailure('download', `${file.path}: HTTP ${response.status}`)
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    length += value.length
    onBytes(value.length)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  const digest = await sha256Hex(bytes)
  if (length !== file.size || digest !== file.sha256) {
    throw new RunFailure('check', file.path)
  }
  return bytes
}

function schemaColumns(reader: unknown): ResultColumn[] {
  const schema = (reader as { schema?: Batch['schema'] }).schema
  return schema === undefined
    ? []
    : schema.fields.map((field) => ({ name: field.name, type: String(field.type) }))
}

interface ActiveRun {
  cancelled: boolean
  abort: AbortController
  connection: AsyncDuckDBConnection | null
  settle(outcome: RunOutcome): void
}

/** The engine's parts that a run uses, so a test can stand in for DuckDB. */
export type RunEngine = Pick<Engine, 'holds' | 'register' | 'keepOnly' | 'open' | 'terminate'>

export class Runner {
  private engine: RunEngine | null = null
  private starting: Promise<RunEngine> | null = null
  private disposed = false
  private active: ActiveRun | null = null

  constructor(
    private readonly assets: EngineAssets,
    private readonly dataBase: Partial<Record<Round, string>>,
    private readonly startEngine: (assets: EngineAssets) => Promise<RunEngine> = Engine.start,
  ) {}

  plan(sql: string, choice: DataChoice, files: PlaygroundFile[]): RunPlan {
    return planRun(sql, choice, files, (file) => this.engine?.holds(file) ?? false)
  }

  /**
   * Runs a plan. `keep` is every file of the current choice: the engine drops the rest. The
   * outcome never holds a partial result: a cancel or a failure holds no rows.
   */
  run(
    plan: RunPlan,
    choice: DataChoice,
    keep: PlaygroundFile[],
    progress: RunProgress,
  ): Promise<RunOutcome> {
    let settle: (outcome: RunOutcome) => void = () => {}
    const outcome = new Promise<RunOutcome>((resolve) => {
      settle = resolve
    })
    const active: ActiveRun = {
      cancelled: false,
      abort: new AbortController(),
      connection: null,
      settle: (result) => settle(result),
    }
    this.active = active
    this.execute(plan, choice, keep, progress, active).then(
      (result) => active.settle(active.cancelled ? { status: 'cancelled' } : result),
      (error: unknown) => active.settle(this.failure(error, active)),
    )
    return outcome.finally(() => {
      if (this.active === active) this.active = null
    })
  }

  /**
   * Stops the run. If DuckDB has not stopped the query a second later, the engine's Worker is
   * terminated, and the next run starts a new engine.
   */
  cancel(): void {
    const active = this.active
    if (active === null || active.cancelled) return
    active.cancelled = true
    active.abort.abort()
    void active.connection?.cancelSent().catch(() => false)
    setTimeout(() => {
      if (this.active !== active) return
      this.engine?.terminate()
      this.engine = null
      active.settle({ status: 'cancelled' })
    }, CANCEL_FALLBACK_MS)
  }

  /** Stops the engine and its Worker, with every file it holds. */
  dispose(): void {
    this.disposed = true
    this.cancel()
    this.engine?.terminate()
    this.engine = null
  }

  private failure(error: unknown, active: ActiveRun): RunOutcome {
    if (active.cancelled) return { status: 'cancelled' }
    if (error instanceof RunFailure) {
      return { status: 'failed', reason: error.reason, message: error.message }
    }
    if (error instanceof CatalogMismatch) {
      return { status: 'failed', reason: 'catalog', message: '', problems: error.problems }
    }
    return {
      status: 'failed',
      reason: 'query',
      message: error instanceof Error ? error.message : String(error),
    }
  }

  /**
   * A run that starts while the engine is still starting waits for that engine, because a
   * second engine would replace the first and leave its Worker running.
   */
  private startedEngine(): Promise<RunEngine> {
    if (this.engine !== null) return Promise.resolve(this.engine)
    this.starting ??= this.startEngine(this.assets).then(
      (engine) => {
        this.starting = null
        if (this.disposed) {
          engine.terminate()
          throw new RunFailure('engine', 'the page closed the engine')
        }
        this.engine = engine
        return engine
      },
      (error: unknown) => {
        this.starting = null
        throw new RunFailure('engine', error instanceof Error ? error.message : String(error))
      },
    )
    return this.starting
  }

  private async execute(
    plan: RunPlan,
    choice: DataChoice,
    keep: PlaygroundFile[],
    progress: RunProgress,
    active: ActiveRun,
  ): Promise<RunOutcome> {
    if (plan.statements.length === 0) throw new RunFailure('empty', '')
    const engine = await this.startedEngine()
    if (active.cancelled) return { status: 'cancelled' }
    await engine.keepOnly(keep)

    let received = 0
    const missing = plan.missing.filter((file) => !engine.holds(file))
    const total = sizeOf(missing)
    if (total > 0) progress.onDownload(0, total)
    const queue = [...missing]
    const worker = async () => {
      for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
        const base = this.dataBase[file.round]
        if (base === undefined)
          throw new RunFailure('download', `round ${file.round} is not pinned`)
        const bytes = await download(`${base}/${file.path}`, file, active.abort.signal, (count) => {
          received += count
          progress.onDownload(received, total)
        })
        if (active.cancelled) return
        await engine.register(file, bytes)
      }
    }
    await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, worker))
    if (active.cancelled) return { status: 'cancelled' }

    progress.onQuery()
    const started = performance.now()
    let connection: AsyncDuckDBConnection
    try {
      connection = await engine.open(choice, plan.tables)
    } catch (error) {
      if (error instanceof CatalogMismatch) throw error
      throw new RunFailure('engine', error instanceof Error ? error.message : String(error))
    }
    active.connection = connection
    // An earlier statement's result streams too, and the page keeps none of it, so no
    // statement can hand the page more than one batch at a time.
    for (const statement of plan.statements.slice(0, -1)) {
      if (active.cancelled) return { status: 'cancelled' }
      const earlier = await connection.send(statement, true)
      for await (const _batch of earlier as AsyncIterable<Batch>) {
        if (active.cancelled) return { status: 'cancelled' }
      }
    }
    const reader = await connection.send(plan.statements.at(-1) ?? '', true)
    let collector: ResultCollector | null = null
    for await (const batch of reader as AsyncIterable<Batch>) {
      if (active.cancelled) break
      collector ??= new ResultCollector(batchColumns(batch))
      if (!collector.add(batchRows(batch))) {
        await connection.cancelSent().catch(() => false)
        break
      }
    }
    if (active.cancelled) return { status: 'cancelled' }
    collector ??= new ResultCollector(schemaColumns(reader))
    return { status: 'done', collector, seconds: (performance.now() - started) / 1000 }
  }
}
