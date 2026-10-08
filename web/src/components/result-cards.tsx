import { CandidateName, Outcome } from '@/components/results'
import { ROUND_DATES } from '@/lib/elections'
import { formatDate, formatInteger, formatShare, t, type Locale } from '@/lib/i18n'
import { candidateColor } from '@/lib/map-colors'
import { isElected, isInRunoff, type CandidateRow, type RaceResults } from '@/lib/results'

/** The two most voted, or every candidate TSE elected and the next one, as in a Senate race. */
export function leadingCandidates(results: RaceResults): CandidateRow[] {
  const elected = results.candidates.filter((candidate) => isElected(candidate.outcome)).length
  return results.candidates.slice(0, Math.max(2, elected + 1))
}

/** The leading candidates of a majoritarian race, each in its map color. */
export function ResultCards({
  locale,
  results,
  ranks,
  candidateHref,
}: {
  locale: Locale
  results: RaceResults
  ranks: ReadonlyMap<number, 0 | 1>
  candidateHref?: (number: number) => string
}) {
  const valid = results.totals.valid
  const senate = results.choicesPerVoter > 1
  return (
    <ul
      className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-3"
      data-testid="result-cards"
    >
      {leadingCandidates(results).map((candidate) => (
        <li
          key={candidate.number}
          className="border-line flex flex-col gap-1 rounded-2xl border p-4"
          data-testid="result-card"
        >
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3.5 shrink-0 rounded-full"
              style={{ background: candidateColor(ranks.get(candidate.number), senate) }}
            />
            <span className="font-display text-xl font-bold break-words">
              <CandidateName candidate={candidate} href={candidateHref} />
            </span>
          </div>
          <p className="text-muted text-sm">
            {candidate.party} · {candidate.number}
          </p>
          <p className="font-display text-4xl font-extrabold tracking-tight tabular-nums">
            {formatShare(locale, candidate.votes, valid)}
          </p>
          <p className="text-muted text-sm tabular-nums">
            {t(locale, 'cards.votes', { votes: formatInteger(locale, candidate.votes) })}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <Outcome locale={locale} outcome={candidate.outcome} />
            {isInRunoff(candidate.outcome) && (
              <span>
                {t(locale, 'cards.runoffDate', {
                  date: formatDate(locale, ROUND_DATES.runoff),
                })}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
