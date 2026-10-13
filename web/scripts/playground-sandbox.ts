/**
 * The playground's locked database in Node, over the fixtures of both rounds, set up before each
 * run as the page sets it up. Tests only.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Manifest } from '../src/lib/manifest'
import { registeredName, type DataChoice } from '../src/lib/playground/choice'
import { playgroundFiles, tableFiles, type PlaygroundFile } from '../src/lib/playground/files'
import {
  columnProblems,
  describeStatement,
  extensionStatements,
  lockStatements,
  viewStatement,
} from '../src/lib/playground/sandbox'
import { nodeDuckDB, withExtensionRepository, type NodeConnection } from './duckdb-node'

const WEB = path.resolve(import.meta.dirname, '..')
const FOLDERS = { 1: 'fixtures', 2: 'fixtures-t2' } as const

export function fixtureFiles(): PlaygroundFile[] {
  return ([1, 2] as const).flatMap((round) => {
    const manifest = JSON.parse(
      readFileSync(path.join(WEB, FOLDERS[round], 'manifest.json'), 'utf-8'),
    ) as Manifest
    return playgroundFiles(manifest, round)
  })
}

export type Row = Record<string, unknown>

export function rows(connection: NodeConnection, sql: string): Row[] {
  return connection
    .query(sql)
    .toArray()
    .map((row) => row.toJSON())
}

export interface Sandbox {
  files: PlaygroundFile[]
  /** Opens a fresh database for `choice`, with its views, checks and lock. */
  fresh(choice: DataChoice): NodeConnection
  stop(): void
}

export async function startSandbox(): Promise<Sandbox> {
  const files = fixtureFiles()
  const db = await nodeDuckDB()
  for (const file of files) {
    db.registerFileBuffer(
      registeredName(file),
      new Uint8Array(readFileSync(path.join(WEB, FOLDERS[file.round], file.path))),
    )
  }
  let stop = () => {}
  const repository = await new Promise<string>((ready) => {
    void withExtensionRepository(
      (served) =>
        new Promise<void>((done) => {
          stop = done
          ready(served)
        }),
    )
  })
  return {
    files,
    stop,
    fresh(choice) {
      db.open({ query: { castBigIntToDouble: false, castDecimalToDouble: true } })
      const connection = db.connect()
      for (const statement of extensionStatements(repository)) connection.query(statement)
      const allowed: string[] = []
      for (const table of new Set(files.map((file) => file.table))) {
        const chosen = tableFiles(files, choice, table)
        if (chosen.length === 0) continue
        connection.query(viewStatement(table, chosen, choice))
        for (const file of chosen) {
          const described = rows(connection, describeStatement(file)).map((row) => ({
            name: String(row.column_name),
            type: String(row.column_type),
          }))
          const problems = columnProblems(file, described)
          if (problems.length > 0) throw new Error(problems.join('\n'))
          allowed.push(registeredName(file))
        }
      }
      for (const statement of lockStatements(allowed)) connection.query(statement)
      return connection
    },
  }
}
