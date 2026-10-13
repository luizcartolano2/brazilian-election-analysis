import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { sha256 } from '../src/lib/manifest'
import {
  loadsFromFile,
  municipalityDifference,
  swingRaces,
  writeValuesFiles,
  type ValuesFiles,
} from './values-files'

async function mapsFolder(): Promise<string> {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'mapas-'))
  const write = async (relative: string, value: unknown) => {
    await mkdir(path.dirname(path.join(folder, relative)), { recursive: true })
    await writeFile(path.join(folder, relative), JSON.stringify(value))
  }
  await write('br/1.json', {
    kind: 'margin',
    units: ['LULA (PT)', 'FLAVIO BOLSONARO (PL)'],
    rows: [[2611606, 25313, 'RECIFE', 0, 10, 1, 5, 20]],
  })
  await write('br/1-votos.json', {
    numbers: [13, 22],
    rows: [[2611606, 25313, 'RECIFE', 20, 10, 5]],
  })
  await write('pe/3.json', { kind: 'margin', units: [], rows: [] })
  await write('pe/3-votos.json', { numbers: [40], rows: [[2611606, 25313, 'RECIFE', 20, 12]] })
  await write('pe/7.json', { kind: 'margin', units: [], rows: [] })
  await write('pe/1-votos.json', { numbers: [13], rows: [[2611606, 25313, 'RECIFE', 20, 9]] })
  return folder
}

describe('writeValuesFiles', () => {
  it('writes the Brazil map and every race’s votes, named and pinned by their bytes', async () => {
    const out = await mkdtemp(path.join(os.tmpdir(), 'public-'))
    const files = await writeValuesFiles(await mapsFolder(), out, 2, (area, name) =>
      loadsFromFile(area, name, 3),
    )
    expect(Object.keys(files).sort()).toEqual(['br/1', 'br/1-votos', 'pe/3-votos'])
    for (const file of Object.values(files)) {
      expect(file.url).toMatch(/^\/mapas\/t2\/(br|pe)\/[0-9]+(-votos)?\.[0-9a-f]{16}\.json$/)
      const bytes = new Uint8Array(await readFile(path.join(out, file.url)))
      expect(sha256(bytes)).toBe(file.sha256)
      expect(file.url).toContain(`.${file.sha256.slice(0, 16)}.json`)
    }
    expect(await readdir(path.join(out, 'mapas', 't2', 'pe'))).toHaveLength(1)
  })

  it('writes names in title case, so the hash covers them', async () => {
    const out = await mkdtemp(path.join(os.tmpdir(), 'public-'))
    const files = await writeValuesFiles(await mapsFolder(), out, 1, (area, name) =>
      loadsFromFile(area, name, 3),
    )
    const votes = JSON.parse(await readFile(path.join(out, files['pe/3-votos']!.url), 'utf-8'))
    expect(votes.rows[0][2]).toBe('Recife')
    const brazil = JSON.parse(await readFile(path.join(out, files['br/1']!.url), 'utf-8'))
    expect(brazil.units).toEqual(['Lula (PT)', 'Flavio Bolsonaro (PL)'])
  })
})

describe('loadsFromFile', () => {
  it('keeps the files that a page loads, and no other', () => {
    expect(loadsFromFile('br', '1', 5570)).toBe(true)
    expect(loadsFromFile('br', '1-votos', 5570)).toBe(true)
    expect(loadsFromFile('pe', '3-votos', 185)).toBe(true)
    expect(loadsFromFile('pe', '1-votos', 185)).toBe(false)
    expect(loadsFromFile('pe', '3', 185)).toBe(false)
    expect(loadsFromFile('df', '3-votos', 1)).toBe(false)
  })
})

describe('swingRaces', () => {
  const RECIFE = [2611606, 25313, 'RECIFE', 20, 10, 5]
  const OLINDA = [2609600, 24570, 'OLINDA', 8, 4, 4]

  async function rounds(second: unknown[][]) {
    const first = await mkdtemp(path.join(os.tmpdir(), 'mapas-1-'))
    const later = await mkdtemp(path.join(os.tmpdir(), 'mapas-2-'))
    for (const [folder, rows] of [
      [first, [RECIFE, OLINDA]],
      [later, second],
    ] as const) {
      await mkdir(path.join(folder, 'br'), { recursive: true })
      await mkdir(path.join(folder, 'pe'), { recursive: true })
      await writeFile(
        path.join(folder, 'br', '1-votos.json'),
        JSON.stringify({ numbers: [13, 22], rows }),
      )
      await writeFile(
        path.join(folder, 'pe', '3-votos.json'),
        JSON.stringify({ numbers: [40, 11], rows }),
      )
    }
    const files: ValuesFiles = {
      'br/1': { url: '/mapas/t1/br/1.x.json', sha256: 'a' },
      'br/1-votos': { url: '/mapas/t1/br/1-votos.x.json', sha256: 'b' },
      'pe/3-votos': { url: '/mapas/t1/pe/3-votos.x.json', sha256: 'c' },
    }
    return { first, later, files }
  }

  it('keeps every race whose two rounds list the same municipalities', async () => {
    const { first, later, files } = await rounds([OLINDA, RECIFE])
    const differences: [string, number[]][] = []
    const races = await swingRaces(first, later, files, files, (race, codes) =>
      differences.push([race, codes]),
    )
    expect(races).toEqual(['br/1', 'pe/3'])
    expect(differences).toEqual([])
  })

  it('names the codes of a pair that differs by one municipality, and leaves it out', async () => {
    const { first, later, files } = await rounds([RECIFE])
    const differences: [string, number[]][] = []
    const races = await swingRaces(first, later, files, files, (race, codes) =>
      differences.push([race, codes]),
    )
    expect(races).toEqual([])
    expect(differences).toEqual([
      ['br/1', [24570]],
      ['pe/3', [24570]],
    ])
  })

  it('compares only the races that both rounds serve', async () => {
    const { first, later, files } = await rounds([RECIFE, OLINDA])
    const { 'pe/3-votos': _governor, ...secondFiles } = files
    expect(await swingRaces(first, later, files, secondFiles, () => {})).toEqual(['br/1'])
  })
})

describe('municipalityDifference', () => {
  it('lists the codes on either side, in order', () => {
    const votes = (codes: number[]) => ({
      numbers: [13],
      rows: codes.map((code): [number, number, string, number, number] => [0, code, 'X', 1, 1]),
    })
    expect(municipalityDifference(votes([3, 1, 2]), votes([2, 4, 1]))).toEqual([3, 4])
  })
})
