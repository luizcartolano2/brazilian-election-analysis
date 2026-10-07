import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { sha256 } from '../src/lib/manifest'
import { dataMode, fixtureSource, loadVersion, type DataSource } from './prepare-data'

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures')
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
    const { summaries } = await loadVersion(source, await pinOf(source))
    expect([...summaries.keys()].sort()).toEqual(['ac', 'br', 'pe', 'se', 'zz'])
  })

  it('fails when the pinned version has no manifest', async () => {
    const source = published((files) => files.delete('manifest.json'))
    await expect(loadVersion(source, 'a'.repeat(64))).rejects.toThrow(/no manifest/)
  })

  it('fails when the manifest differs from the pinned checksum', async () => {
    const source = published()
    await expect(loadVersion(source, 'b'.repeat(64))).rejects.toThrow(/data-version.ts pins/)
  })

  it('fails when a summary differs from its manifest entry', async () => {
    const source = published((files) => {
      const summary = files.get('2026/t1/resumo/pe.json') as Uint8Array
      const tampered = new Uint8Array(summary)
      const last = tampered.length - 2
      tampered[last] = (tampered[last] ?? 0) ^ 1
      files.set('2026/t1/resumo/pe.json', tampered)
    })
    await expect(loadVersion(source, await pinOf(source))).rejects.toThrow(/pe.json differs/)
  })

  it('fails when a summary is missing', async () => {
    const source = published((files) => files.delete('2026/t1/resumo/se.json'))
    await expect(loadVersion(source, await pinOf(source))).rejects.toThrow(/se.json/)
  })

  it('refuses a partial version or one built from other sources', async () => {
    for (const field of ['parcial', 'fontes_tse'] as const) {
      const source = published((files) => {
        const manifest = JSON.parse(new TextDecoder().decode(files.get('manifest.json')))
        manifest[field] = !manifest[field]
        files.set('manifest.json', new TextEncoder().encode(JSON.stringify(manifest)))
      })
      await expect(loadVersion(source, await pinOf(source)), field).rejects.toThrow(/partial/)
    }
  })

  it('refuses a version of another year or round', async () => {
    const source = published((files) => {
      const manifest = JSON.parse(new TextDecoder().decode(files.get('manifest.json')))
      manifest.turno = 2
      files.set('manifest.json', new TextEncoder().encode(JSON.stringify(manifest)))
    })
    await expect(loadVersion(source, await pinOf(source))).rejects.toThrow(/round 2/)
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
    const { summaries } = await loadVersion(source, await pinOf(source))
    const first = JSON.parse(new TextDecoder().decode(summaries.get('pe')))
    expect(first.turno).toBe(1)
  })

  it('reads the fixtures without a pin, and still checks their summaries', async () => {
    const { summaries } = await loadVersion(fixtureSource(FIXTURES))
    expect(summaries.size).toBe(5)
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
