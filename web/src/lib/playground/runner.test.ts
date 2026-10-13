import { createHash } from 'node:crypto'
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DataChoice } from './choice'
import type { Batch } from './engine'
import type { PlaygroundFile } from './files'
import { CANCEL_FALLBACK_MS, planRun, Runner, type RunEngine } from './runner'

const BYTES = new TextEncoder().encode('pinned bytes')
const FILE: PlaygroundFile = {
  table: 'votos_municipio',
  round: 1,
  race: 1,
  area: 'ac',
  path: '2026/t1/totais/municipio/cargo=1/uf=AC.parquet',
  size: BYTES.length,
  sha256: createHash('sha256').update(BYTES).digest('hex'),
}
const CHOICE: DataChoice = { rounds: [1], races: [1], areas: ['ac'] }
const QUERY = 'SELECT sum(votos) FROM votos_municipio'
const PROGRESS = { onDownload: () => {}, onQuery: () => {} }

function batch(rows: number[]): Batch {
  return {
    numRows: rows.length,
    schema: { fields: [{ name: 'n', type: { toString: () => 'Int32' } }] },
    getChildAt: () => ({ get: (row: number) => rows[row] }),
  }
}

/** An engine that answers with `send`, and counts what the run did to it. */
function fakeEngine(send: () => AsyncIterable<Batch>, cancelSent: () => Promise<boolean>) {
  const registered = new Set<string>()
  const state = { terminated: false, registrations: 0 }
  const engine: RunEngine = {
    holds: (file) => registered.has(file.path),
    register: async (file) => {
      registered.add(file.path)
      state.registrations += 1
    },
    keepOnly: async () => {},
    open: async () =>
      ({
        query: async () => ({}),
        send: async () => send(),
        cancelSent,
      }) as unknown as AsyncDuckDBConnection,
    terminate: () => {
      state.terminated = true
      registered.clear()
    },
  }
  return { engine, state }
}

function serve(bytes: Uint8Array) {
  const fetch = vi.fn(async () => new Response(bytes.slice()))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

async function* rowsOf(...batches: Batch[]): AsyncIterable<Batch> {
  for (const entry of batches) yield entry
}

const never = (): AsyncIterable<Batch> => ({
  [Symbol.asyncIterator]: () => ({ next: () => new Promise<IteratorResult<Batch>>(() => {}) }),
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('planRun', () => {
  it("lists the named tables' files, and the bytes that the engine lacks", () => {
    const other = { ...FILE, table: 'secoes', path: '2026/t1/secoes/uf=AC.parquet', race: null }
    const plan = planRun(`${QUERY}; SELECT 1`, CHOICE, [FILE, other], () => false)
    expect([...plan.tables.keys()]).toEqual(['votos_municipio'])
    expect(plan.statements).toHaveLength(2)
    expect(plan.missingBytes).toBe(FILE.size)
    expect(planRun(QUERY, CHOICE, [FILE], () => true).missing).toEqual([])
  })
})

describe('Runner', () => {
  it('returns the rows of a run, after it downloads and checks the file', async () => {
    const fetch = serve(BYTES)
    const fake = fakeEngine(
      () => rowsOf(batch([1, 2])),
      async () => true,
    )
    const runner = new Runner(
      { assetBase: '/a', workerScript: '/w' },
      { 1: '/data' },
      async () => fake.engine,
    )
    const outcome = await runner.run(runner.plan(QUERY, CHOICE, [FILE]), CHOICE, [FILE], PROGRESS)
    expect(outcome.status).toBe('done')
    expect(outcome.status === 'done' && outcome.collector.shown).toEqual([[1], [2]])
    expect(fetch).toHaveBeenCalledWith(`/data/${FILE.path}`, expect.anything())
    expect(fake.state.registrations).toBe(1)
  })

  it('fails a file whose bytes differ from its pin, with no rows', async () => {
    serve(new TextEncoder().encode('tampered bytes'))
    const fake = fakeEngine(
      () => rowsOf(batch([1])),
      async () => true,
    )
    const runner = new Runner(
      { assetBase: '/a', workerScript: '/w' },
      { 1: '/data' },
      async () => fake.engine,
    )
    const outcome = await runner.run(runner.plan(QUERY, CHOICE, [FILE]), CHOICE, [FILE], PROGRESS)
    expect(outcome).toEqual({ status: 'failed', reason: 'check', message: FILE.path })
    expect(fake.state.registrations).toBe(0)
  })

  it("names the engine's own message when a query fails", async () => {
    serve(BYTES)
    const fake = fakeEngine(
      () => {
        throw new Error('Permission Error: Cannot access file "https://example.com/x.csv"')
      },
      async () => true,
    )
    const runner = new Runner(
      { assetBase: '/a', workerScript: '/w' },
      { 1: '/data' },
      async () => fake.engine,
    )
    const outcome = await runner.run(runner.plan(QUERY, CHOICE, [FILE]), CHOICE, [FILE], PROGRESS)
    expect(outcome).toEqual({
      status: 'failed',
      reason: 'query',
      message: 'Permission Error: Cannot access file "https://example.com/x.csv"',
    })
  })

  it('terminates the engine when DuckDB does not stop a cancelled query, and the next run starts over', async () => {
    const fetch = serve(BYTES)
    const engines: ReturnType<typeof fakeEngine>[] = []
    const runner = new Runner({ assetBase: '/a', workerScript: '/w' }, { 1: '/data' }, async () => {
      const fake = fakeEngine(
        engines.length === 0 ? never : () => rowsOf(batch([7])),
        async () => false,
      )
      engines.push(fake)
      return fake.engine
    })
    const running = runner.run(runner.plan(QUERY, CHOICE, [FILE]), CHOICE, [FILE], PROGRESS)
    await vi.waitFor(() => expect(engines[0]?.state.registrations).toBe(1))
    const started = Date.now()
    runner.cancel()
    expect(await running).toEqual({ status: 'cancelled' })
    expect(Date.now() - started).toBeLessThan(CANCEL_FALLBACK_MS + 500)
    expect(engines[0]?.state.terminated).toBe(true)

    const next = await runner.run(runner.plan(QUERY, CHOICE, [FILE]), CHOICE, [FILE], PROGRESS)
    expect(next.status === 'done' && next.collector.shown).toEqual([[7]])
    expect(engines).toHaveLength(2)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
