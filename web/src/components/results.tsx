import { AppLink } from '@/components/app-link'
import { formatInteger, formatShare, t, type Locale, type MessageKey } from '@/lib/i18n'
import { isElected, isInRunoff, type CandidateRow, type RaceResults } from '@/lib/results'
import { candidateRowId } from '@/lib/search'

const OUTCOME_KEYS: Record<string, MessageKey> = {
  Eleito: 'outcome.elected',
  'Eleito por QP': 'outcome.electedQuota',
  'Eleito por média': 'outcome.electedAverage',
  '2º turno': 'outcome.runoff',
  Suplente: 'outcome.substitute',
  'Não eleito': 'outcome.notElected',
}

/** TSE's own outcome, translated when it is a known value and shown as published otherwise. */
export function outcomeLabel(locale: Locale, outcome: string): string {
  const key = OUTCOME_KEYS[outcome]
  return key === undefined ? outcome : t(locale, key)
}

/** Every known outcome's label, for client code that gets no message files. */
export function outcomeLabels(locale: Locale): Record<string, string> {
  return Object.fromEntries(
    Object.keys(OUTCOME_KEYS).map((outcome) => [outcome, outcomeLabel(locale, outcome)]),
  )
}

export function Outcome({ locale, outcome }: { locale: Locale; outcome: string }) {
  if (outcome === '') return null
  const label = outcomeLabel(locale, outcome)
  const highlighted = isElected(outcome) || isInRunoff(outcome)
  return (
    <span
      className={
        highlighted
          ? 'rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-900'
          : 'text-xs text-slate-600'
      }
    >
      {label}
    </span>
  )
}

function ShareBar({ part, whole }: { part: number; whole: number }) {
  const width = whole > 0 ? `${((part / whole) * 100).toFixed(2)}%` : '0%'
  return (
    <div aria-hidden="true" className="mt-1 h-1.5 w-full rounded bg-slate-200">
      <div className="h-full rounded bg-slate-700" style={{ width }} />
    </div>
  )
}

export function CandidateTable({
  locale,
  candidates,
  validVotes,
  caption,
  withRowIds = false,
  candidateHref,
}: {
  locale: Locale
  candidates: CandidateRow[]
  validVotes: number
  caption: string
  /** Only one table on a page can carry the ids. */
  withRowIds?: boolean
  /** A candidacy's own page, in the races that have them. */
  candidateHref?: (number: number) => string
}) {
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-slate-300 text-left text-xs text-slate-600">
          <th scope="col" className="py-1 pr-2 font-medium">
            {t(locale, 'results.candidate')}
          </th>
          <th scope="col" className="w-24 py-1 pr-2 text-right font-medium">
            {t(locale, 'results.votes')}
          </th>
          <th scope="col" className="w-16 py-1 text-right font-medium">
            %
          </th>
        </tr>
      </thead>
      <tbody>
        {candidates.map((candidate) => (
          <tr
            key={candidate.number}
            id={withRowIds ? candidateRowId(candidate.number) : undefined}
            className="scroll-mt-4 border-b border-slate-100 align-top"
          >
            <td className="py-2 pr-2">
              <div className="font-medium break-words">
                <CandidateName candidate={candidate} href={candidateHref} />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                <span>
                  {candidate.party} · {candidate.number}
                </span>
                <Outcome locale={locale} outcome={candidate.outcome} />
              </div>
              <ShareBar part={candidate.votes} whole={validVotes} />
            </td>
            <td className="py-2 pr-2 text-right tabular-nums">
              {formatInteger(locale, candidate.votes)}
            </td>
            <td className="py-2 text-right tabular-nums">
              {formatShare(locale, candidate.votes, validVotes)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CandidateName({
  candidate,
  href,
}: {
  candidate: CandidateRow
  href?: (number: number) => string
}) {
  if (href === undefined) return <>{candidate.name}</>
  return (
    <AppLink href={href(candidate.number)} className="underline">
      {candidate.name}
    </AppLink>
  )
}

export function UnderAppealTable({
  locale,
  results,
  candidateHref,
}: {
  locale: Locale
  results: RaceResults
  candidateHref?: (number: number) => string
}) {
  if (
    results.candidatesUnderAppeal.length === 0 &&
    results.partiesUnderAppeal.length === 0 &&
    results.otherUnderAppeal === 0
  ) {
    return null
  }
  return (
    <section className="mt-6">
      <h3 className="text-base font-semibold">{t(locale, 'results.underAppealTitle')}</h3>
      <p className="mt-1 text-sm text-slate-700">{t(locale, 'results.underAppealNote')}</p>
      <table className="mt-2 w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">{t(locale, 'results.underAppealTitle')}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">{t(locale, 'results.candidateOrList')}</th>
            <th scope="col">{t(locale, 'results.votes')}</th>
          </tr>
        </thead>
        <tbody>
          {results.candidatesUnderAppeal.map((candidate) => (
            <tr
              key={`c${candidate.number}`}
              id={candidateRowId(candidate.number)}
              className="scroll-mt-4 border-b border-slate-100"
            >
              <td className="py-1.5 pr-2">
                <span className="font-medium break-words">
                  <CandidateName candidate={candidate} href={candidateHref} />
                </span>{' '}
                <span className="text-xs text-slate-600">
                  {candidate.party} · {candidate.number}
                </span>{' '}
                <Outcome locale={locale} outcome={candidate.outcome} />
              </td>
              <td className="w-28 py-1.5 text-right tabular-nums">
                {formatInteger(locale, candidate.votes)}
              </td>
            </tr>
          ))}
          {results.partiesUnderAppeal.map((party) => (
            <tr key={`p${party.number}`} className="border-b border-slate-100">
              <td className="py-1.5 pr-2">
                {t(locale, 'results.listOf', { party: party.party })}{' '}
                <span className="text-xs text-slate-600">{party.number}</span>
              </td>
              <td className="w-28 py-1.5 text-right tabular-nums">
                {formatInteger(locale, party.listVotes)}
              </td>
            </tr>
          ))}
          {results.otherUnderAppeal > 0 && (
            <tr className="border-b border-slate-100">
              <td className="py-1.5 pr-2">{t(locale, 'results.otherUnderAppeal')}</td>
              <td className="w-28 py-1.5 text-right tabular-nums">
                {formatInteger(locale, results.otherUnderAppeal)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

export function PartyTable({ locale, results }: { locale: Locale; results: RaceResults }) {
  if (results.parties === null) return null
  // raceResults has already failed the build if these do not add up to the valid votes.
  const candidateVotes = results.parties.reduce((sum, party) => sum + party.candidateVotes, 0)
  const listVotes = results.parties.reduce((sum, party) => sum + party.listVotes, 0)
  const valid = results.totals.valid
  return (
    <section className="mt-6">
      <h3 className="text-base font-semibold">{t(locale, 'results.partiesTitle')}</h3>
      <p className="mt-1 text-sm text-slate-700">{t(locale, 'results.partiesNote')}</p>
      <table className="mt-2 w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">{t(locale, 'results.partiesTitle')}</caption>
        <thead>
          <tr className="border-b border-slate-300 text-left text-xs text-slate-600">
            <th scope="col" className="py-1 pr-2 font-medium">
              {t(locale, 'results.party')}
            </th>
            <th scope="col" className="py-1 pr-2 text-right font-medium">
              {t(locale, 'results.candidateVotes')}
            </th>
            <th scope="col" className="py-1 pr-2 text-right font-medium">
              {t(locale, 'results.listVotes')}
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              {t(locale, 'results.partyTotal')}
            </th>
          </tr>
        </thead>
        <tbody>
          {results.parties.map((party) => (
            <tr key={party.number} className="border-b border-slate-100">
              <td className="py-1.5 pr-2 break-words">
                <span className="font-medium">{party.party}</span>{' '}
                <span className="text-xs text-slate-600">{party.number}</span>
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {formatInteger(locale, party.candidateVotes)}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {formatInteger(locale, party.listVotes)}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {formatInteger(locale, party.total)}
                <div className="text-xs text-slate-600">
                  {formatShare(locale, party.total, valid)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-sm text-slate-700" data-testid="party-sum">
        {t(locale, 'results.partySum', {
          candidates: formatInteger(locale, candidateVotes),
          list: formatInteger(locale, listVotes),
          valid: formatInteger(locale, valid),
        })}
      </p>
    </section>
  )
}

export function TotalsTable({ locale, results }: { locale: Locale; results: RaceResults }) {
  const totals = results.totals
  const rows: { key: MessageKey; value: number; whole: number }[] = [
    { key: 'totals.valid', value: totals.valid, whole: totals.totalVotes },
    { key: 'totals.blank', value: totals.blank, whole: totals.totalVotes },
    { key: 'totals.null', value: totals.null, whole: totals.totalVotes },
    { key: 'totals.technicalNull', value: totals.technicalNull, whole: totals.totalVotes },
  ]
  if (totals.annulled > 0) {
    rows.push({ key: 'totals.annulled', value: totals.annulled, whole: totals.totalVotes })
  }
  if (totals.annulledUnderAppeal > 0) {
    rows.push({
      key: 'totals.annulledUnderAppeal',
      value: totals.annulledUnderAppeal,
      whole: totals.totalVotes,
    })
  }
  rows.push(
    { key: 'totals.totalVotes', value: totals.totalVotes, whole: 0 },
    { key: 'totals.eligible', value: totals.eligible, whole: 0 },
    { key: 'totals.attendance', value: totals.attendance, whole: totals.eligible },
    { key: 'totals.abstention', value: totals.abstention, whole: totals.eligible },
  )
  return (
    <>
      <table className="mt-6 w-full table-fixed border-collapse text-sm">
        <caption className="text-left text-base font-semibold">{t(locale, 'totals.title')}</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-slate-100">
              <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                {t(locale, row.key)}
              </th>
              <td className="w-28 py-1.5 pr-2 text-right tabular-nums">
                {formatInteger(locale, row.value)}
              </td>
              <td className="w-16 py-1.5 text-right text-slate-600 tabular-nums">
                {row.whole > 0 ? formatShare(locale, row.value, row.whole) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <EligibleGapNote locale={locale} results={results} />
    </>
  )
}

/** TSE counts some eligible voters as neither turnout nor abstention, such as abroad. */
export function EligibleGapNote({ locale, results }: { locale: Locale; results: RaceResults }) {
  const totals = results.totals
  const gap = totals.eligible - totals.attendance - totals.abstention
  if (gap === 0) return null
  return (
    <p className="mt-2 text-xs text-slate-600">
      {t(locale, 'totals.eligibleGap', { count: formatInteger(locale, gap) })}
    </p>
  )
}
