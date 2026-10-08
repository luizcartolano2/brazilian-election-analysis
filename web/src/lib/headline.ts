/** A race's headline, built from TSE's outcomes only. It never compares votes to name a winner. */
import { NUMBER_LOCALES } from './format'
import { SENATE } from './elections'
import { formatInteger, t, type Locale } from './i18n'
import { isElected, isInRunoff, type RaceResults } from './results'

export type Headline =
  | { form: 'count'; count: number }
  | { form: 'seats'; seats: number }
  | { form: 'runoff'; names: string[] }
  | { form: 'elected'; names: string[]; senate: boolean }
  | { form: 'mostVoted'; name: string }

/**
 * The first form that applies. A proportional race is checked first, because its elected
 * outcomes, such as "Eleito por QP", would otherwise read as a majoritarian winner.
 */
export function raceHeadline(results: RaceResults, proportional: boolean): Headline | null {
  const elected = results.candidates.filter((candidate) => isElected(candidate.outcome))
  if (proportional) {
    return elected.length > 0
      ? { form: 'count', count: elected.length }
      : { form: 'seats', seats: results.seats }
  }
  const runoff = results.candidates.filter((candidate) => isInRunoff(candidate.outcome))
  if (runoff.length > 0) return { form: 'runoff', names: runoff.map((candidate) => candidate.name) }
  if (elected.length > 0) {
    return {
      form: 'elected',
      names: elected.map((candidate) => candidate.name),
      senate: results.race === SENATE,
    }
  }
  const first = results.candidates[0]
  return first === undefined ? null : { form: 'mostVoted', name: first.name }
}

function joinNames(locale: Locale, names: string[]): string {
  return new Intl.ListFormat(NUMBER_LOCALES[locale], { type: 'conjunction' }).format(names)
}

/** Portuguese marks gender in "eleito" and "eleita", and the summaries hold none, so no form uses them. */
export function headlineText(locale: Locale, headline: Headline, race: string): string {
  switch (headline.form) {
    case 'count':
      return t(locale, 'headline.count', { race, count: formatInteger(locale, headline.count) })
    case 'seats':
      return t(locale, 'headline.seats', { race, seats: formatInteger(locale, headline.seats) })
    case 'runoff':
      return t(locale, headline.names.length > 1 ? 'headline.runoffMany' : 'headline.runoffOne', {
        names: joinNames(locale, headline.names),
      })
    case 'elected': {
      // The Senate has no runoff, so its winners are not said to win "in the first round".
      const many = headline.names.length > 1
      const key = headline.senate
        ? many
          ? 'headline.electedSenateMany'
          : 'headline.electedSenateOne'
        : many
          ? 'headline.electedMany'
          : 'headline.electedOne'
      return t(locale, key, { names: joinNames(locale, headline.names) })
    }
    case 'mostVoted':
      return t(locale, 'headline.mostVoted', { name: headline.name })
  }
}
