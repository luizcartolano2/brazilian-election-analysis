/** What a candidate page computes from the summaries: the place in the race, and the share in each state. */
import type { RaceResults } from './results'

/** The candidate's place among the valid candidates, from 1, or null when TSE did not count the votes. */
export function placeOf(results: RaceResults, numero: number): number | null {
  const index = results.candidates.findIndex((candidate) => candidate.number === numero)
  return index === -1 ? null : index + 1
}

export interface StateShare {
  area: string
  votes: number
  valid: number
  /** Whether the candidate was the most voted in the state. */
  led: boolean
}

/** The candidate's share in each state, from the highest to the lowest. */
export function sharesByState(
  states: { area: string; results: RaceResults }[],
  numero: number,
): StateShare[] {
  return states
    .map(({ area, results }) => ({
      area,
      votes: results.candidates.find((candidate) => candidate.number === numero)?.votes ?? 0,
      valid: results.totals.valid,
      led: results.candidates[0]?.number === numero,
    }))
    .sort(
      (a, b) => b.votes / (b.valid || 1) - a.votes / (a.valid || 1) || a.area.localeCompare(b.area),
    )
}
