import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Run } from '../src/lib/drilldown/queries'
import type { Manifest } from '../src/lib/manifest'
import { playgroundFiles, unlistFiles, type ListedFile } from '../src/lib/playground/files'
import { sha256Of } from './duckdb-assets'
import { nodeRunner } from './duckdb-node'
import { candidateLists, writePlaygroundData } from './playground-data'

const WEB = path.join(import.meta.dirname, '..')

function fixtureManifest(folder: string): Manifest {
  return JSON.parse(readFileSync(path.join(WEB, folder, 'manifest.json'), 'utf-8')) as Manifest
}

describe('playgroundFiles', () => {
  it('lists each Parquet file that the catalog names, with its size and SHA-256', () => {
    const manifest = fixtureManifest('fixtures')
    const files = playgroundFiles(manifest, 1)
    const parquet = manifest.arquivos.filter((entry) => entry.path.endsWith('.parquet'))
    expect(files.map((file) => file.path).sort()).toEqual(parquet.map((entry) => entry.path).sort())
    expect(files.find((file) => file.path === '2026/t1/votos/cargo=1/uf=AC.parquet')).toEqual({
      table: 'votos_secao',
      round: 1,
      race: 1,
      area: 'ac',
      path: '2026/t1/votos/cargo=1/uf=AC.parquet',
      size: parquet.find((entry) => entry.path === '2026/t1/votos/cargo=1/uf=AC.parquet')?.size,
      sha256: parquet.find((entry) => entry.path === '2026/t1/votos/cargo=1/uf=AC.parquet')?.sha256,
    })
  })

  it('leaves out a file that the catalog does not name, such as one of estimates', () => {
    const manifest = fixtureManifest('fixtures')
    const invented = { path: '2026/t1/estimativas/uf=PE.parquet', size: 10, sha256: 'a'.repeat(64) }
    const files = playgroundFiles({ ...manifest, arquivos: [...manifest.arquivos, invented] }, 1)
    expect(files.map((file) => file.path)).not.toContain(invented.path)
    expect(files.some((file) => file.path.endsWith('.json'))).toBe(false)
  })

  it("takes the municipality list from round 1's version only", () => {
    const tables = (folder: string, round: 1 | 2) =>
      playgroundFiles(fixtureManifest(folder), round).map((file) => file.table)
    expect(tables('fixtures', 1)).toContain('municipios')
    expect(tables('fixtures-t2', 2)).not.toContain('municipios')
    expect(tables('fixtures-t2', 2)).toContain('candidatos')
  })

  it('round-trips through the compact list', () => {
    const files = playgroundFiles(fixtureManifest('fixtures-t2'), 2)
    const listed: ListedFile[] = files.map((file) => [
      file.table,
      file.race,
      file.area,
      file.path,
      file.size,
      file.sha256,
    ])
    expect(unlistFiles(2, listed)).toEqual(files)
  })
})

describe('candidateLists', () => {
  let run: Run

  beforeAll(async () => {
    run = await nodeRunner()
  }, 30_000)

  it("lists each race's candidates by area, with names in title case", async () => {
    const lists = await candidateLists(
      run,
      path.join(WEB, 'fixtures', '2026', 't1', 'candidatos.parquet'),
    )
    expect(Object.keys(lists['1'] ?? {})).toEqual(['br'])
    expect(lists['1']?.br).toContainEqual([13, 'Lula', 'PT'])
    expect(Object.keys(lists['3'] ?? {}).sort()).toEqual(['ac', 'pe', 'se'])
    expect(Object.keys(lists['25'] ?? {})).toEqual(['pe'])
    for (const byArea of Object.values(lists)) {
      for (const candidates of Object.values(byArea)) {
        const numbers = candidates.map(([numero]) => numero)
        expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
      }
    }
  })
})

describe('writePlaygroundData', () => {
  const folders: string[] = []

  afterEach(async () => {
    await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true })))
  })

  it('writes the lists under a folder named for their content, with their SHA-256', async () => {
    const publicDir = await mkdtemp(path.join(tmpdir(), 'playground-'))
    folders.push(publicDir)
    const rounds = [
      {
        round: 1 as const,
        files: playgroundFiles(fixtureManifest('fixtures'), 1),
        candidates: { '1': { br: [[13, 'Lula', 'PT']] as [number, string, string][] } },
      },
    ]
    const info = await writePlaygroundData(publicDir, rounds)
    expect(info.base).toMatch(/^\/consultas\/[0-9a-f]{16}$/)
    const folder = path.join(publicDir, info.base)
    expect((await readdir(folder)).sort()).toEqual(['arquivos.json', 'candidatos-1-1.json'])
    expect(sha256Of(await readFile(path.join(folder, 'arquivos.json')))).toBe(info.files)
    expect(sha256Of(await readFile(path.join(folder, 'candidatos-1-1.json')))).toBe(
      info.candidates['1-1'],
    )
    const again = await writePlaygroundData(publicDir, rounds)
    expect(again).toEqual(info)
  })
})
