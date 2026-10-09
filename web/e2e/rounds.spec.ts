import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const DATA = path.join(import.meta.dirname, '..', '.data')

function readJson<T>(relative: string): T {
  return JSON.parse(readFileSync(path.join(DATA, relative), 'utf-8')) as T
}

test('the fixture build holds round 2, marked as synthetic, beside round 1', () => {
  expect(readJson<{ rounds: number[] }>('source.json').rounds).toEqual([1, 2])
  const round2 = readJson<{ dataBase: string; synthetic: boolean }>('rounds/2/source.json')
  expect(round2).toMatchObject({ dataBase: '/_fixtures/data-t2', synthetic: true })
  expect(readJson<{ synthetic: boolean }>('rounds/1/source.json').synthetic).toBe(false)
  const acre = readJson<{ turno: number; corridas: { cargo: number }[] }>('rounds/2/resumo/ac.json')
  expect(acre.turno).toBe(2)
  expect(acre.corridas.map((race) => race.cargo)).toEqual([1, 3])
  expect(readJson<{ units: string[] }>('rounds/2/mapas/ac/3.json').units).toHaveLength(2)
})
