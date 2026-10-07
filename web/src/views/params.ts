import { coveredAreas } from '@/lib/data'
import { ABROAD } from '@/lib/elections'
import { raceSlugs } from './area-views'

export type AreaParams = Promise<{ uf: string }>
export type RaceParams = Promise<{ uf: string; cargo: string }>

export function areaParams(): { uf: string }[] {
  return coveredAreas().map((uf) => ({ uf }))
}

/** Abroad shows its one race in full on its own page, so it gets no race pages. */
export function raceParams(): { uf: string; cargo: string }[] {
  return coveredAreas()
    .filter((uf) => uf !== ABROAD.code)
    .flatMap((uf) => raceSlugs(uf).map((cargo) => ({ uf, cargo })))
}
