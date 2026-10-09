import { raceByCode } from './elections'
import { isInRunoff, type Summary } from './results'

/** The chosen candidates' numbers in each race, keyed as `<area> <race slug>`. */
function candidatesByRace(
  summaries: ReadonlyMap<string, Summary>,
  keep: (outcome: string) => boolean,
): Map<string, number[]> {
  const byRace = new Map<string, number[]>()
  for (const [area, summary] of summaries) {
    for (const race of summary.corridas) {
      const numbers = race.candidatos
        .filter((candidate) => keep(candidate.resultado))
        .map((candidate) => candidate.numero)
        .sort((a, b) => a - b)
      if (numbers.length > 0) {
        byRace.set(`${area} ${raceByCode(race.cargo)?.slug ?? race.cargo}`, numbers)
      }
    }
  }
  return byRace
}

/**
 * Where the two rounds' versions disagree on who reached round 2. A recount of round 1 that
 * changes the runoffs, such as a cancelled one in Rio, shows here until its version is pinned.
 */
export function runoffMismatches(
  first: ReadonlyMap<string, Summary>,
  second: ReadonlyMap<string, Summary>,
): string[] {
  const sent = candidatesByRace(first, isInRunoff)
  const held = candidatesByRace(second, () => true)
  const problems: string[] = []
  for (const [race, numbers] of held) {
    const expected = sent.get(race)
    if (expected === undefined) {
      problems.push(`round 2 holds ${race}, which round 1 sends to no runoff`)
    } else if (expected.join() !== numbers.join()) {
      problems.push(
        `round 2 holds ${numbers.join(' and ')} in ${race}, but round 1 sends ${expected.join(' and ')}`,
      )
    }
  }
  for (const race of sent.keys()) {
    if (!held.has(race)) problems.push(`round 1 sends ${race} to a runoff, which round 2 lacks`)
  }
  return problems
}
