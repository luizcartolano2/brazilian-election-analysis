import { readFileSync } from 'node:fs'
import path from 'node:path'
import { displayName } from '../src/lib/names'
import type { Summary } from '../src/lib/results'

export function summary(area: string, round: 1 | 2 = 1): Summary {
  const folder = round === 1 ? 'fixtures' : 'fixtures-t2'
  const file = path.join(
    import.meta.dirname,
    '..',
    folder,
    '2026',
    `t${round}`,
    'resumo',
    `${area}.json`,
  )
  return JSON.parse(readFileSync(file, 'utf-8')) as Summary
}

/** The rounds that the build under test holds: a build before the round-2 pin has round 1 only. */
export function builtRounds(): number[] {
  const file = path.join(import.meta.dirname, '..', '.data', 'source.json')
  return (JSON.parse(readFileSync(file, 'utf-8')) as { rounds: number[] }).rounds
}

/** The candidate that TSE's outcome marks as elected in a race, named as the site shows it. */
export function elected(area: string, race: number, round: 1 | 2): string {
  const entry = summary(area, round).corridas.find((candidate) => candidate.cargo === race)
  const winner = entry?.candidatos.find((candidate) => candidate.resultado.startsWith('Eleito'))
  if (winner === undefined) throw new Error(`no one elected in ${area} race ${race}`)
  return displayName(winner.nome)
}

/** The valid candidate with the most votes in a race, named as the site shows it. */
export function leader(area: string, race: number): string {
  const entry = summary(area).corridas.find((candidate) => candidate.cargo === race)
  const valid = (entry?.candidatos ?? []).filter((candidate) => candidate.destino === 'Válido')
  const top = valid.sort((a, b) => b.votos - a.votos)[0]
  if (top === undefined) throw new Error(`no candidates in ${area} race ${race}`)
  return displayName(top.nome)
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
  '/2026/segundo-turno/',
  '/2026/segundo-turno/ac/',
  '/2026/segundo-turno/zz/',
  '/en/2026/segundo-turno/ac/governador/',
]
