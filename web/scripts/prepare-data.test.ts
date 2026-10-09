import { readFileSync } from 'node:fs'
import { mkdtemp, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { sha256 } from '../src/lib/manifest'
import { EXTENSION_PATH, packageFile, parquetExtension } from './duckdb-assets'
import { DATA_VERSIONS, versionUrl } from '../src/data-version'
import { runoffMismatches } from '../src/lib/rounds'
import type { Summary } from '../src/lib/results'
import {
  dataMode,
  fixtureSource,
  loadVersion,
  plannedRounds,
  verifyPublishedAssets,
  type DataSource,
} from './prepare-data'

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures')
const FIXTURES_T2 = path.join(import.meta.dirname, '..', 'fixtures-t2')
const fixtureManifest = readFileSync(path.join(FIXTURES, 'manifest.json'))

/** The fixtures, served as if they were a complete, published version. */
function published(change: (files: Map<string, Uint8Array>) => void = () => {}): DataSource {
  const manifest = JSON.parse(fixtureManifest.toString('utf-8'))
  manifest.fontes_tse = true
  manifest.parcial = false
  const files = new Map<string, Uint8Array>([
    ['manifest.json', new TextEncoder().encode(JSON.stringify(manifest))],
  ])
  for (const entry of manifest.arquivos as { path: string }[]) {
    files.set(entry.path, new Uint8Array(readFileSync(path.join(FIXTURES, entry.path))))
  }
  change(files)
  return { mode: 'published', read: async (relative) => files.get(relative) ?? null }
}

function pinOf(source: DataSource): Promise<string> {
  return source.read('manifest.json').then((bytes) => sha256(bytes as Uint8Array))
}

describe('loadVersion', () => {
  it('accepts the pinned manifest and every summary it lists', async () => {
    const source = published()
    const { summaries } = await loadVersion(source, 1, await pinOf(source))
    expect([...summaries.keys()].sort()).toEqual(['ac', 'br', 'pe', 'se', 'zz'])
  })

  it('fails when the pinned version has no manifest', async () => {
    const source = published((files) => files.delete('manifest.json'))
    await expect(loadVersion(source, 1, 'a'.repeat(64))).rejects.toThrow(/no manifest/)
  })

  it('fails when the manifest differs from the pinned checksum', async () => {
    const source = published()
    await expect(loadVersion(source, 1, 'b'.repeat(64))).rejects.toThrow(/data-version.ts pins/)
  })

  it('fails when a summary differs from its manifest entry', async () => {
    const source = published((files) => {
      const summary = files.get('2026/t1/resumo/pe.json') as Uint8Array
      const tampered = new Uint8Array(summary)
      const last = tampered.length - 2
      tampered[last] = (tampered[last] ?? 0) ^ 1
      files.set('2026/t1/resumo/pe.json', tampered)
    })
    await expect(loadVersion(source, 1, await pinOf(source))).rejects.toThrow(/pe.json differs/)
  })

  it('fails when a summary is missing', async () => {
    const source = published((files) => files.delete('2026/t1/resumo/se.json'))
    await expect(loadVersion(source, 1, await pinOf(source))).rejects.toThrow(/se.json/)
  })

  it('refuses a partial version or one built from other sources', async () => {
    for (const field of ['parcial', 'fontes_tse'] as const) {
      const source = published((files) => {
        const manifest = JSON.parse(new TextDecoder().decode(files.get('manifest.json')))
        manifest[field] = !manifest[field]
        files.set('manifest.json', new TextEncoder().encode(JSON.stringify(manifest)))
      })
      await expect(loadVersion(source, 1, await pinOf(source)), field).rejects.toThrow(/partial/)
    }
  })

  it('refuses a version of another year or round', async () => {
    const source = published((files) => {
      const manifest = JSON.parse(new TextDecoder().decode(files.get('manifest.json')))
      manifest.turno = 2
      files.set('manifest.json', new TextEncoder().encode(JSON.stringify(manifest)))
    })
    await expect(loadVersion(source, 1, await pinOf(source))).rejects.toThrow(/round 2/)
  })

  it('reads only the summaries of the round the app shows', async () => {
    const source = published((files) => {
      const manifest = JSON.parse(new TextDecoder().decode(files.get('manifest.json')))
      const stray = new TextEncoder().encode('{"area": "PE"}')
      manifest.arquivos.push({
        path: '2026/t2/resumo/pe.json',
        size: stray.byteLength,
        sha256: sha256(stray),
      })
      files.set('2026/t2/resumo/pe.json', stray)
      files.set('manifest.json', new TextEncoder().encode(JSON.stringify(manifest)))
    })
    const { summaries } = await loadVersion(source, 1, await pinOf(source))
    const first = JSON.parse(new TextDecoder().decode(summaries.get('pe')))
    expect(first.turno).toBe(1)
  })

  it('reads the fixtures without a pin, and still checks their summaries', async () => {
    const { summaries } = await loadVersion(fixtureSource(FIXTURES), 1)
    expect(summaries.size).toBe(5)
  })
})

describe('the rounds', () => {
  const parsed = (summaries: Map<string, Uint8Array>) =>
    new Map(
      [...summaries].map(([area, bytes]) => [
        area,
        JSON.parse(new TextDecoder().decode(bytes)) as Summary,
      ]),
    )

  it('refuses a round-1 version pinned as round 2', async () => {
    const source = published()
    await expect(loadVersion(source, 2, await pinOf(source))).rejects.toThrow(
      /round 2 holds 2026 round 1/,
    )
  })

  it('reads the round-2 fixtures as round 2 only, marked as synthetic', async () => {
    const { manifest, summaries } = await loadVersion(fixtureSource(FIXTURES_T2), 2)
    expect([...summaries.keys()].sort()).toEqual(['ac', 'br', 'pe', 'se', 'zz'])
    expect(manifest.sintetico).toBe(true)
    await expect(loadVersion(fixtureSource(FIXTURES_T2), 1)).rejects.toThrow(/round 1 holds/)
  })

  it('builds round 1 alone while round 2 has no pin', () => {
    const pins = { 1: DATA_VERSIONS[1], 2: null }
    expect(plannedRounds('published', pins).map((planned) => planned.round)).toEqual([1])
  })

  it('builds round 2 from its own pin, and both fixture rounds', () => {
    const second = { name: 'round-two', manifestSha256: 'c'.repeat(64) }
    const planned = plannedRounds('published', { 1: DATA_VERSIONS[1], 2: second })
    expect(planned.map((entry) => [entry.round, entry.dataBase])).toEqual([
      [1, versionUrl(DATA_VERSIONS[1])],
      [2, versionUrl(second)],
    ])
    expect(plannedRounds('fixtures').map((entry) => [entry.round, entry.dataBase])).toEqual([
      [1, '/_fixtures/data'],
      [2, '/_fixtures/data-t2'],
    ])
  })

  it('finds that the two fixture rounds agree on the runoffs', async () => {
    const first = await loadVersion(fixtureSource(FIXTURES), 1)
    const second = await loadVersion(fixtureSource(FIXTURES_T2), 2)
    expect(runoffMismatches(parsed(first.summaries), parsed(second.summaries))).toEqual([])
  })
})

describe('dataMode', () => {
  it('reads the published version unless told to use the fixtures', () => {
    expect(dataMode({})).toBe('published')
    expect(dataMode({ ELEICOES_DATA: 'fixtures' })).toBe('fixtures')
  })

  it('refuses the fixtures on Vercel', () => {
    expect(() => dataMode({ ELEICOES_DATA: 'fixtures', VERCEL: '1' })).toThrow(/Vercel/)
  })
})

describe('verifyPublishedAssets', () => {
  /** Serves `files` as the Worker would, for as long as `check` runs. */
  async function withAssets(
    files: Map<string, Uint8Array>,
    check: (assetBase: string) => Promise<void>,
  ): Promise<void> {
    const server = createServer((request, response) => {
      const body = files.get((request.url ?? '').slice(1))
      response.writeHead(body === undefined ? 404 : 200).end(body)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      await check(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
    } finally {
      server.close()
    }
  }

  async function publishedAssets(): Promise<Map<string, Uint8Array>> {
    return new Map([
      ['duckdb-eh.wasm', new Uint8Array(await readFile(packageFile('duckdb-eh.wasm')))],
      [EXTENSION_PATH, new Uint8Array(await readFile(await parquetExtension()))],
    ])
  }

  it('caches the extension the Worker serves when both assets match', async () => {
    const files = await publishedAssets()
    const cacheDir = await mkdtemp(path.join(tmpdir(), 'assets-'))
    await withAssets(files, (assetBase) => verifyPublishedAssets(assetBase, cacheDir))
    expect(sha256(await readFile(path.join(cacheDir, EXTENSION_PATH)))).toBe(
      sha256(files.get(EXTENSION_PATH) as Uint8Array),
    )
  })

  it('fails when the Worker serves another extension', async () => {
    const files = await publishedAssets()
    files.set(EXTENSION_PATH, new TextEncoder().encode('not the extension'))
    const cacheDir = await mkdtemp(path.join(tmpdir(), 'assets-'))
    await withAssets(files, async (assetBase) => {
      await expect(verifyPublishedAssets(assetBase, cacheDir)).rejects.toThrow(/the pin is/)
    })
  })

  it('fails when the Worker serves another module', async () => {
    const files = await publishedAssets()
    files.set('duckdb-eh.wasm', new TextEncoder().encode('not the module'))
    await withAssets(files, async (assetBase) => {
      await expect(verifyPublishedAssets(assetBase)).rejects.toThrow(/locked package/)
    })
  })

  it('names the target to publish when an asset is missing', async () => {
    const files = await publishedAssets()
    files.delete(EXTENSION_PATH)
    await withAssets(files, async (assetBase) => {
      await expect(verifyPublishedAssets(assetBase)).rejects.toThrow(/duckdb-wasm target/)
    })
  })
})
