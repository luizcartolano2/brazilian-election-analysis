/**
 * The playground's query engine in the browser: one DuckDB-WASM Worker that holds the checked
 * files, and a fresh, locked database for every run.
 */
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { instantiate } from '../drilldown/browser'
import { registeredName, type DataChoice } from './choice'
import type { PlaygroundFile } from './files'
import type { ResultColumn } from './result'
import {
  columnProblems,
  describeStatement,
  extensionStatements,
  lockStatements,
  viewStatement,
} from './sandbox'

export interface EngineAssets {
  /** The folder with DuckDB's WebAssembly module and its Parquet extension. */
  assetBase: string
  /** DuckDB's worker script, served from the page's own origin. */
  workerScript: string
}

/** A pinned file whose columns differ from the catalog's. */
export class CatalogMismatch extends Error {}

/** The parts of an Arrow record batch that a result reads. */
export interface Batch {
  numRows: number
  schema: { fields: { name: string; type: { toString(): string } }[] }
  getChildAt(index: number): { get(row: number): unknown } | null
}

export function batchColumns(batch: Batch): ResultColumn[] {
  return batch.schema.fields.map((field) => ({ name: field.name, type: String(field.type) }))
}

/** A batch's rows by position, so two columns with one name both stay. */
export function batchRows(batch: Batch): unknown[][] {
  const width = batch.schema.fields.length
  const children = Array.from({ length: width }, (_, index) => batch.getChildAt(index))
  const rows: unknown[][] = []
  for (let row = 0; row < batch.numRows; row++) {
    rows.push(children.map((child) => child?.get(row) ?? null))
  }
  return rows
}

function absolute(url: string): string {
  return new URL(url, window.location.href).toString()
}

export class Engine {
  private readonly registered = new Set<string>()
  private readonly described = new Set<string>()
  private connection: AsyncDuckDBConnection | null = null

  private constructor(
    private readonly db: AsyncDuckDB,
    private readonly worker: Worker,
    private readonly repository: string,
  ) {}

  static async start(assets: EngineAssets): Promise<Engine> {
    const duckdb = await import('@duckdb/duckdb-wasm')
    const worker = new Worker(absolute(assets.workerScript))
    try {
      const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker)
      await instantiate(db, absolute(`${assets.assetBase}/duckdb-eh.wasm`))
      return new Engine(db, worker, absolute(`${assets.assetBase}/extensions`))
    } catch (error) {
      worker.terminate()
      throw error
    }
  }

  holds(file: PlaygroundFile): boolean {
    return this.registered.has(registeredName(file))
  }

  /** Hands a checked file to the engine. The bytes move to its Worker, so the page keeps none. */
  async register(file: PlaygroundFile, bytes: Uint8Array): Promise<void> {
    const name = registeredName(file)
    await this.db.registerFileBuffer(name, bytes)
    this.registered.add(name)
  }

  /** Drops every file that the current choice no longer needs. */
  async keepOnly(files: PlaygroundFile[]): Promise<void> {
    const kept = new Set(files.map(registeredName))
    for (const name of [...this.registered]) {
      if (kept.has(name)) continue
      await this.db.dropFile(name)
      this.registered.delete(name)
      this.described.delete(name)
    }
  }

  /**
   * Opens a fresh database and sets it up before any statement of the visitor's: the views over
   * `tables`, the catalog check of each file, and the lock. A fresh database drops whatever an
   * earlier run created, so no macro of a visitor's can take over a view or the check.
   */
  async open(
    choice: DataChoice,
    tables: Map<string, PlaygroundFile[]>,
  ): Promise<AsyncDuckDBConnection> {
    await this.connection?.close()
    this.connection = null
    await this.db.open({ query: { castBigIntToDouble: false, castDecimalToDouble: true } })
    const connection = await this.db.connect()
    for (const statement of extensionStatements(this.repository)) await connection.query(statement)
    const allowed: string[] = []
    for (const [table, files] of tables) {
      for (const file of files) {
        const name = registeredName(file)
        allowed.push(name)
        // A file's bytes match its pinned SHA-256, so one check per registration is enough.
        if (this.described.has(name)) continue
        const described = (await connection.query(describeStatement(file)))
          .toArray()
          .map((row: { toJSON(): Record<string, unknown> }) => row.toJSON())
          .map((row) => ({ name: String(row.column_name), type: String(row.column_type) }))
        const problems = columnProblems(file, described)
        if (problems.length > 0) throw new CatalogMismatch(problems.join('; '))
        this.described.add(name)
      }
      await connection.query(viewStatement(table, files, choice))
    }
    for (const statement of lockStatements(allowed)) await connection.query(statement)
    this.connection = connection
    return connection
  }

  terminate(): void {
    this.worker.terminate()
    this.registered.clear()
    this.described.clear()
    this.connection = null
  }
}
