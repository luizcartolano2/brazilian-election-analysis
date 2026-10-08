import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Summary } from '../src/lib/results'

export function summary(area: string): Summary {
  const file = path.join(
    import.meta.dirname,
    '..',
    'fixtures',
    '2026',
    't1',
    'resumo',
    `${area}.json`,
  )
  return JSON.parse(readFileSync(file, 'utf-8')) as Summary
}

/** The valid candidate with the most votes in a race. */
export function leader(area: string, race: number): string {
  const entry = summary(area).corridas.find((candidate) => candidate.cargo === race)
  const valid = (entry?.candidatos ?? []).filter((candidate) => candidate.destino === 'Válido')
  const top = valid.sort((a, b) => b.votos - a.votos)[0]
  if (top === undefined) throw new Error(`no candidates in ${area} race ${race}`)
  return top.nome
}

/** Every kind of page the build produces, in both languages. */
export const PAGES = [
  '/2026/',
  '/2026/pe/',
  '/2026/pe/senador/',
  '/2026/pe/deputado-federal/',
  '/2026/zz/',
  '/2026/fontes/',
  '/en/2026/',
  '/en/2026/se/',
  '/en/2026/se/deputado-estadual/',
  '/en/2026/fontes/',
  '/2026/presidente/13/',
  '/2026/pe/governador/55/',
  '/en/2026/pe/senador/130/',
]
