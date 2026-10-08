import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { oversizedPages } from './page-size'

describe('oversizedPages', () => {
  it('names each page over the limit with its size, and passes the rest', async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'out-'))
    await mkdir(path.join(folder, '2026', 'sp'), { recursive: true })
    await writeFile(path.join(folder, '2026', 'sp', 'index.html'), 'x'.repeat(120))
    await writeFile(path.join(folder, 'index.html'), 'x'.repeat(80))
    await writeFile(path.join(folder, 'big.json'), 'x'.repeat(500))

    expect(await oversizedPages(folder, 100)).toEqual([
      { page: path.join('2026', 'sp', 'index.html'), bytes: 120 },
    ])
  })
})
