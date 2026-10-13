import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  checkedFile,
  clearCheckedFiles,
  GoneError,
  loadSwing,
  loadValues,
  type MapSource,
} from './race-map'

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

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  clearCheckedFiles()
})

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

describe('checkedFile', () => {
  it('fetches and hashes a file once for two maps that read it', async () => {
    const fetch = answer(200)
    const digest = vi.spyOn(crypto.subtle, 'digest')
    const [first, second] = await Promise.all([
      loadValues(SOURCE),
      loadValues({ ...SOURCE, share: { numero: 22, label: 'Flávio', step: 10 } }),
    ])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(digest).toHaveBeenCalledTimes(1)
    expect(first.rows[0]?.[4]).toBe(60)
    expect(second.rows[0]?.[4]).toBe(40)
  })

  it('keeps no entry for a load that fails', async () => {
    const failing = answer(500)
    await expect(checkedFile(SOURCE.url, SHA)).rejects.toThrow(/HTTP 500/)
    expect(failing).toHaveBeenCalledTimes(1)
    const working = answer(200)
    await expect(checkedFile(SOURCE.url, SHA)).resolves.toEqual(VOTES)
    expect(working).toHaveBeenCalledTimes(1)
  })

  it('keeps two pins of one address apart', async () => {
    const fetch = answer(200)
    await expect(checkedFile(SOURCE.url, SHA)).resolves.toEqual(VOTES)
    await expect(checkedFile(SOURCE.url, 'f'.repeat(64))).rejects.toThrow(/differs/)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('fetches again, past the browser’s cache, on a retry', async () => {
    const fetch = answer(200)
    await checkedFile(SOURCE.url, SHA)
    await checkedFile(SOURCE.url, SHA)
    await checkedFile(SOURCE.url, SHA, true)
    expect(fetch.mock.calls.map((call) => (call as unknown[])[1])).toEqual([
      expect.objectContaining({ cache: 'default' }),
      expect.objectContaining({ cache: 'reload' }),
    ])
  })

  it('keeps the six most recently used files', async () => {
    const fetch = answer(200)
    const urls = Array.from({ length: 7 }, (_, index) => `/mapas/t1/br/${index}.json`)
    for (const url of urls) await checkedFile(url, SHA)
    await checkedFile(urls[6] ?? '', SHA)
    expect(fetch).toHaveBeenCalledTimes(7)
    await checkedFile(urls[0] ?? '', SHA)
    expect(fetch).toHaveBeenCalledTimes(8)
  })
})

const ROUND_2 = { numbers: [22, 13], rows: [[2611606, 25313, 'Recife', 100, 45, 55]] }
const round2Bytes = new TextEncoder().encode(JSON.stringify(ROUND_2))
const ROUND_2_SHA = createHash('sha256').update(round2Bytes).digest('hex')
const SWING: Extract<MapSource, { kind: 'swing' }> = {
  kind: 'swing',
  files: [
    { url: '/mapas/t1/br/1-votos.0123456789abcdef.json', sha256: SHA },
    { url: '/mapas/t2/br/1-votos.fedcba9876543210.json', sha256: ROUND_2_SHA },
  ],
  frame: { kind: 'swing', units: ['Lula'] },
  swing: { numero: 13, other: 22, label: 'Lula' },
}

function answerByRound(round1: Response, round2: Response) {
  const fetch = vi.fn(async (url: string) => (url.includes('/t1/') ? round1 : round2).clone())
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('loadSwing', () => {
  it('builds the swing from both rounds’ checked files', async () => {
    answerByRound(
      new Response(bytes.slice().buffer, { status: 200 }),
      new Response(round2Bytes.slice().buffer, { status: 200 }),
    )
    const data = await loadSwing(SWING)
    expect(data.kind).toBe('swing')
    expect(data.rows).toEqual([[2611606, 25313, 'Recife', 60, 40, 55, 45]])
  })

  it('fails when one file differs from its pin', async () => {
    answerByRound(
      new Response(bytes.slice().buffer, { status: 200 }),
      new Response(new TextEncoder().encode('{}').buffer, { status: 200 }),
    )
    const failure = await loadSwing(SWING).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(Error)
    expect(failure).not.toBeInstanceOf(GoneError)
  })

  it('offers a reload when the round-2 file is gone', async () => {
    answerByRound(
      new Response(bytes.slice().buffer, { status: 200 }),
      new Response(null, { status: 404 }),
    )
    await expect(loadSwing(SWING)).rejects.toBeInstanceOf(GoneError)
  })

  it('offers a reload when a file is gone, also when the other fails its check', async () => {
    answerByRound(
      new Response(null, { status: 404 }),
      new Response(new TextEncoder().encode('{}').buffer, { status: 200 }),
    )
    await expect(loadSwing(SWING)).rejects.toBeInstanceOf(GoneError)
  })

  it('fetches both files again on a retry', async () => {
    const fetch = answerByRound(
      new Response(bytes.slice().buffer, { status: 200 }),
      new Response(round2Bytes.slice().buffer, { status: 200 }),
    )
    await loadSwing(SWING)
    await loadSwing(SWING, true)
    expect(fetch.mock.calls.map((call) => (call as unknown[])[1])).toEqual([
      expect.objectContaining({ cache: 'default' }),
      expect.objectContaining({ cache: 'default' }),
      expect.objectContaining({ cache: 'reload' }),
      expect.objectContaining({ cache: 'reload' }),
    ])
  })
})
