import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GoneError, loadValues, type MapSource } from './race-map'

const VOTES = { numbers: [13, 22], rows: [[2611606, 25313, 'Recife', 100, 60, 40]] }
const bytes = new TextEncoder().encode(JSON.stringify(VOTES))
const SHA = createHash('sha256').update(bytes).digest('hex')
const SOURCE: Extract<MapSource, { kind: 'file' }> = {
  kind: 'file',
  url: '/mapas/t1/br/1-votos.0123456789abcdef.json',
  sha256: SHA,
  frame: { kind: 'share', step: 10, units: ['Lula'] },
  share: { numero: 13, label: 'Lula', step: 10 },
}

function answer(status: number, body: Uint8Array = bytes) {
  const fetch = vi.fn(async () => new Response(body.slice().buffer, { status }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => vi.unstubAllGlobals())

describe('loadValues', () => {
  it('builds the candidate’s share map from its race’s checked votes', async () => {
    answer(200)
    const data = await loadValues(SOURCE)
    expect(data.kind).toBe('share')
    expect(data.rows).toEqual([[2611606, 25313, 'Recife', 0, 60, -1, 0, 100]])
  })

  it('reads the cache on a first load and bypasses it on a retry', async () => {
    const fetch = answer(200)
    await loadValues(SOURCE)
    await loadValues(SOURCE, true)
    expect(fetch.mock.calls.map((call) => (call as unknown[])[1])).toEqual([
      expect.objectContaining({ cache: 'default' }),
      expect.objectContaining({ cache: 'reload' }),
    ])
  })

  it('refuses a file whose SHA-256 differs from the pin', async () => {
    answer(200, new TextEncoder().encode('{"numbers":[],"rows":[]}'))
    await expect(loadValues(SOURCE)).rejects.toThrow(/differs from its pinned SHA-256/)
  })

  it('tells a file gone after a deploy apart from a failure', async () => {
    answer(404)
    await expect(loadValues(SOURCE)).rejects.toBeInstanceOf(GoneError)
    answer(500)
    await expect(loadValues(SOURCE)).rejects.not.toBeInstanceOf(GoneError)
  })
})
