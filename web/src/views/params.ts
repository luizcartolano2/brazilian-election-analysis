import { coveredAreas, hasRound } from '@/lib/data'
import { ABROAD, PRESIDENT, raceByCode, YEAR, type Round } from '@/lib/elections'
import { roundPath } from '@/lib/paths'
import { raceSlugs } from './area-views'

export type AreaParams = Promise<{ uf: string }>
export type RaceParams = Promise<{ uf: string; cargo: string }>

/** Round 2 has no pin yet, so its addresses are the ones that exist whatever TSE publishes. */
function waitingForRunoff(round: Round): boolean {
  return round === 2 && !hasRound(2)
}

function areaParamsOf(round: Round): { uf: string }[] {
  // Round 2 holds President in every area of round 1, which the build checks once it is pinned.
  return coveredAreas(waitingForRunoff(round) ? 1 : round).map((uf) => ({ uf }))
}

/** Abroad shows its one race in full on its own page, so it gets no race pages. */
function raceParamsOf(round: Round): { uf: string; cargo: string }[] {
  const states = (source: Round) => coveredAreas(source).filter((uf) => uf !== ABROAD.code)
  if (waitingForRunoff(round)) {
    const president = raceByCode(PRESIDENT)?.slug ?? 'presidente'
    return states(1).map((uf) => ({ uf, cargo: president }))
  }
  return states(round).flatMap((uf) => raceSlugs(uf, round).map((cargo) => ({ uf, cargo })))
}

// Next calls these with arguments of its own, so each takes none.
export function areaParams(): { uf: string }[] {
  return areaParamsOf(1)
}

export function raceParams(): { uf: string; cargo: string }[] {
  return raceParamsOf(1)
}

export function runoffAreaParams(): { uf: string }[] {
  return areaParamsOf(2)
}

export function runoffRaceParams(): { uf: string; cargo: string }[] {
  return raceParamsOf(2)
}

/**
 * The same page in another round: the same area and race when that page exists, else the same
 * area, else the round's Brazil page. Addresses are in Portuguese.
 */
export function counterpartPath(target: Round, area?: string, slug?: string): string {
  if (area !== undefined && slug !== undefined) {
    if (raceParamsOf(target).some((entry) => entry.uf === area && entry.cargo === slug)) {
      return roundPath(target, `/${YEAR}/${area}/${slug}/`)
    }
  }
  if (area !== undefined && areaParamsOf(target).some((entry) => entry.uf === area)) {
    return roundPath(target, `/${YEAR}/${area}/`)
  }
  return roundPath(target, `/${YEAR}/`)
}
