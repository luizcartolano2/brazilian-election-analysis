/** A race's headline, built from TSE's outcomes only. It never compares votes to name a winner. */
import { NUMBER_LOCALES } from './format'
import { ROUND_DATES, SENATE, type Round } from './elections'
import { formatDate, formatInteger, formatOrdinal, t, type Locale } from './i18n'
import { isElected, isInRunoff, VALID, type RaceResults, type SummaryCandidate } from './results'

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
export function headlineText(
  locale: Locale,
  headline: Headline,
  race: string,
  round: Round = 1,
): string {
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
        : round === 2
          ? many
            ? 'headline.electedRunoffMany'
            : 'headline.electedRunoffOne'
          : many
            ? 'headline.electedMany'
            : 'headline.electedOne'
      return t(locale, key, { names: joinNames(locale, headline.names) })
    }
    case 'mostVoted':
      return t(locale, 'headline.mostVoted', { name: headline.name })
  }
}

export type CandidateHeadline =
  | { form: 'runoff' }
  | { form: 'elected'; senate: boolean }
  | { form: 'place'; place: number }
  | { form: 'status'; status: string }

/** A candidate page's headline: its own outcome from TSE, or else its place in the race. */
export function candidateHeadline(
  candidate: SummaryCandidate,
  place: number | null,
  race: number,
): CandidateHeadline {
  if (candidate.destino !== VALID) return { form: 'status', status: candidate.destino }
  if (isInRunoff(candidate.resultado)) return { form: 'runoff' }
  if (isElected(candidate.resultado)) return { form: 'elected', senate: race === SENATE }
  if (place === null) throw new Error(`candidate ${candidate.numero} is valid but has no place`)
  return { form: 'place', place }
}

export function candidateHeadlineText(
  locale: Locale,
  headline: CandidateHeadline,
  round: Round = 1,
): string {
  switch (headline.form) {
    case 'runoff':
      return t(locale, 'candidate.headlineRunoff', {
        date: formatDate(locale, ROUND_DATES.runoff),
      })
    case 'elected':
      if (headline.senate) return t(locale, 'candidate.headlineSenate')
      return t(
        locale,
        round === 2 ? 'candidate.headlineElectedRunoff' : 'candidate.headlineElected',
      )
    case 'place':
      return t(locale, 'candidate.headlinePlace', { place: formatOrdinal(locale, headline.place) })
    case 'status':
      return t(locale, 'candidate.headlineStatus', { status: headline.status })
  }
}
