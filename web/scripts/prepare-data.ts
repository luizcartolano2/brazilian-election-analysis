/**
 * Copies the pinned data version's manifest and summaries into .data/ before `next build`,
 * after checking each one, so a wrong or tampered file fails the build.
 *
 * ELEICOES_DATA=fixtures reads web/fixtures instead, for CI and local work. Fixtures have
 * no published version, so only the summaries are checked against their manifest.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DATA_VERSION, VERSION_URL } from '../src/data-version'
import {
  parseManifest,
  summaryPaths,
  verifyFile,
  verifyManifest,
  type Manifest,
} from '../src/lib/manifest'

export type DataMode = 'published' | 'fixtures'

export interface DataSource {
  mode: DataMode
  read(relativePath: string): Promise<Uint8Array | null>
}

const WEB_ROOT = path.resolve(import.meta.dirname, '..')
export const DATA_DIR = path.join(WEB_ROOT, '.data')

export function fixtureSource(root = path.join(WEB_ROOT, 'fixtures')): DataSource {
  return {
    mode: 'fixtures',
    async read(relativePath) {
      try {
        return new Uint8Array(await readFile(path.join(root, relativePath)))
      } catch {
        return null
      }
    },
  }
}

export function publishedSource(baseUrl = VERSION_URL): DataSource {
  return {
    mode: 'published',
    async read(relativePath) {
      const response = await fetch(`${baseUrl}/${relativePath}`)
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`${relativePath}: HTTP ${response.status}`)
      return new Uint8Array(await response.arrayBuffer())
    },
  }
}

/** Reads and checks the manifest and every summary. Writes nothing. */
export async function loadVersion(
  source: DataSource,
  expectedSha256: string = DATA_VERSION.manifestSha256,
): Promise<{ manifest: Manifest; manifestBytes: Uint8Array; summaries: Map<string, Uint8Array> }> {
  const manifestBytes = await source.read('manifest.json')
  const manifest =
    source.mode === 'published'
      ? verifyManifest(manifestBytes, expectedSha256)
      : parseManifest(manifestBytes ?? new Uint8Array())
  const summaries = new Map<string, Uint8Array>()
  for (const summaryPath of summaryPaths(manifest)) {
    const bytes = await source.read(summaryPath)
    verifyFile(manifest, summaryPath, bytes)
    summaries.set(path.basename(summaryPath, '.json'), bytes as Uint8Array)
  }
  return { manifest, manifestBytes: manifestBytes as Uint8Array, summaries }
}

async function main(): Promise<void> {
  const mode: DataMode = process.env.ELEICOES_DATA === 'fixtures' ? 'fixtures' : 'published'
  const source = mode === 'fixtures' ? fixtureSource() : publishedSource()
  const { manifestBytes, summaries } = await loadVersion(source)

  await rm(DATA_DIR, { recursive: true, force: true })
  await mkdir(path.join(DATA_DIR, 'resumo'), { recursive: true })
  await writeFile(path.join(DATA_DIR, 'manifest.json'), manifestBytes)
  for (const [area, bytes] of summaries) {
    await writeFile(path.join(DATA_DIR, 'resumo', `${area}.json`), bytes)
  }
  const version = mode === 'published' ? DATA_VERSION.name : null
  await writeFile(path.join(DATA_DIR, 'source.json'), JSON.stringify({ mode, version }))
  console.log(`data: ${mode} ${version ?? ''}, ${summaries.size} summaries checked`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main().catch((error: unknown) => {
    console.error(`prepare-data failed: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  })
}
