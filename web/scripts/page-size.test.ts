import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { oversizedPages, valuesFilesOf } from './page-size'

const FILE = '/mapas/t1/br/1-votos.0123456789abcdef.json'

async function exported(files: Record<string, string>): Promise<string> {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'out-'))
  for (const [file, body] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(folder, file)), { recursive: true })
    await writeFile(path.join(folder, file), body)
  }
  return folder
}

describe('oversizedPages', () => {
  it('names each page over the limit with its size, and passes the rest', async () => {
    const folder = await exported({
      '2026/sp/index.html': 'x'.repeat(120),
      'index.html': 'x'.repeat(80),
      'big.json': 'x'.repeat(500),
    })
    expect(await oversizedPages(folder, 100)).toEqual([
      { page: path.join('2026', 'sp', 'index.html'), bytes: 120, html: 120, files: [] },
    ])
  })

  it('counts the values files that a page loads, once each', async () => {
    const page = `<p data-url="${FILE}">${'x'.repeat(40)}</p><p>${FILE}</p>`
    const folder = await exported({
      'index.html': 'x'.repeat(10),
      '2026/presidente/13/index.html': page,
      [FILE.slice(1)]: 'x'.repeat(70),
    })
    const [found] = await oversizedPages(folder, 100)
    expect(found?.page).toBe(path.join('2026', 'presidente', '13', 'index.html'))
    expect(found?.files).toEqual([{ url: FILE, bytes: 70 }])
    expect(found?.bytes).toBe(page.length + 70)
    expect(await oversizedPages(folder, 1000)).toEqual([])
  })
})

describe('a page under the limit alone', () => {
  it('fails once its values files take it over the limit', async () => {
    const page = `<p>${FILE}</p>`
    const folder = await exported({ 'index.html': page, [FILE.slice(1)]: 'x'.repeat(80) })
    expect(page.length).toBeLessThan(100)
    const [found] = await oversizedPages(folder, 100)
    expect(found).toEqual({
      page: 'index.html',
      bytes: page.length + 80,
      html: page.length,
      files: [{ url: FILE, bytes: 80 }],
    })
  })

  it('names the page when a values file it loads is missing', async () => {
    const folder = await exported({ 'index.html': `<p>${FILE}</p>` })
    await expect(oversizedPages(folder, 100)).rejects.toThrow(`index.html loads ${FILE}`)
  })
})

describe('valuesFilesOf', () => {
  it('finds the values files that a page names, and nothing else', () => {
    expect(valuesFilesOf(`"url":"${FILE}","boundary":"/_fixtures/geo/pe.json"`)).toEqual([FILE])
  })
})
