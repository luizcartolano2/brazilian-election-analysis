import { CandidateTable, PartyTable, TotalsTable, UnderAppealTable } from '@/components/results'
import type { RaceInfo } from '@/lib/elections'
import { t, type Locale } from '@/lib/i18n'
import type { RaceResults } from '@/lib/results'

export function RaceNote({
  locale,
  info,
  results,
}: {
  locale: Locale
  info: RaceInfo
  results: RaceResults
}) {
  const notes: string[] = []
  const seats = String(results.seats)
  if (results.choicesPerVoter === 2) {
    notes.push(t(locale, 'race.twoChoices', { seats }))
  } else if (info.proportional) {
    notes.push(t(locale, 'race.proportionalSeats', { seats }))
  } else if (results.seats > 1) {
    notes.push(t(locale, 'race.manySeatsOneChoice', { seats }))
  }
  if (notes.length === 0) return null
  return <p className="mt-1 text-sm text-slate-700">{notes.join(' ')}</p>
}

export function FullResults({
  locale,
  info,
  results,
  caption,
}: {
  locale: Locale
  info: RaceInfo
  results: RaceResults
  caption: string
}) {
  return (
    <>
      <RaceNote locale={locale} info={info} results={results} />
      <div className="mt-3">
        <CandidateTable
          locale={locale}
          candidates={results.candidates}
          validVotes={results.totals.valid}
          caption={caption}
          withRowIds
        />
      </div>
      <UnderAppealTable locale={locale} results={results} />
      <PartyTable locale={locale} results={results} />
      <TotalsTable locale={locale} results={results} />
    </>
  )
}
