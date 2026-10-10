import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { prunePayloads } from './prune-payloads'

async function exported(files: string[]): Promise<string> {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'out-'))
  for (const file of files) {
    await mkdir(path.dirname(path.join(folder, file)), { recursive: true })
    await writeFile(path.join(folder, file), 'x'.repeat(10))
  }
  return folder
}

describe('prunePayloads', () => {
  it('keeps each page and its index.txt, and deletes the segment files', async () => {
    const folder = await exported([
      'index.html',
      'index.txt',
      '__next._full.txt',
      '__next._tree.txt',
      '2026/pe/index.html',
      '2026/pe/index.txt',
      '2026/pe/__next._full.txt',
      '2026/pe/__next.!KHB0KQ.2026.$d$uf.__PAGE__.txt',
      '2026/pe/__next.en.2026.$d$uf.__PAGE__.txt',
      'busca/abc/candidatos.json',
      '_next/static/chunks/main.js',
    ])
    expect(await prunePayloads(folder)).toEqual({ files: 5, bytes: 50 })
    const left = (await readdir(folder, { recursive: true, withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => path.relative(folder, path.join(entry.parentPath, entry.name)))
      .sort()
    expect(left).toEqual([
      path.join('2026', 'pe', 'index.html'),
      path.join('2026', 'pe', 'index.txt'),
      path.join('_next', 'static', 'chunks', 'main.js'),
      path.join('busca', 'abc', 'candidatos.json'),
      'index.html',
      'index.txt',
    ])
  })

  it('refuses a folder that is not a static export', async () => {
    const folder = await exported(['index.html', '__next._full.txt'])
    await expect(prunePayloads(folder)).rejects.toThrow(/not a static export/)
  })
})
