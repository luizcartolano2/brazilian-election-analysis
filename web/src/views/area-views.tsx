import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CandidateTable, PartyTable, TotalsTable, UnderAppealTable } from '@/components/results'
import { PageShell } from '@/components/page-shell'
import { getSummary } from '@/lib/data'
import {
  ABROAD,
  areaByCode,
  areaName,
  raceByCode,
  raceBySlug,
  raceName,
  STATES,
  YEAR,
  type RaceInfo,
  type StateInfo,
} from '@/lib/elections'
import { formatInteger, formatShare, localePath, t, type Locale } from '@/lib/i18n'
import {
  isElected,
  raceResults,
  raceSlugsOf,
  type RaceResults,
  type SummaryRace,
} from '@/lib/results'

const HEADLINE_SIZE = { majoritarian: 3, proportional: 5 }

function brazil(locale: Locale): string {
  return t(locale, 'area.brazil')
}

function TurnoutSummary({ locale, results }: { locale: Locale; results: RaceResults }) {
  const totals = results.totals
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2 rounded bg-slate-50 p-3 text-sm">
      <div>
        <dt className="text-xs text-slate-600">{t(locale, 'totals.eligible')}</dt>
        <dd className="font-medium tabular-nums">{formatInteger(locale, totals.eligible)}</dd>
      </div>
      <div>
        <dt className="text-xs text-slate-600">{t(locale, 'totals.attendance')}</dt>
        <dd className="font-medium tabular-nums">
          {formatInteger(locale, totals.attendance)}
          <span className="block text-xs font-normal text-slate-600">
            {formatShare(locale, totals.attendance, totals.eligible)}
          </span>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-slate-600">{t(locale, 'totals.abstention')}</dt>
        <dd className="font-medium tabular-nums">
          {formatInteger(locale, totals.abstention)}
          <span className="block text-xs font-normal text-slate-600">
            {formatShare(locale, totals.abstention, totals.eligible)}
          </span>
        </dd>
      </div>
    </dl>
  )
}

function RaceNote({
  locale,
  info,
  results,
}: {
  locale: Locale
  info: RaceInfo
  results: RaceResults
}) {
  const notes: string[] = []
  if (results.choicesPerVoter === 2) {
    notes.push(t(locale, 'race.twoChoices', { seats: String(results.seats) }))
  } else if (info.proportional) {
    notes.push(t(locale, 'race.proportionalSeats', { seats: String(results.seats) }))
  }
  if (notes.length === 0) return null
  return <p className="mt-1 text-sm text-slate-700">{notes.join(' ')}</p>
}

function knownRace(race: SummaryRace): RaceInfo {
  const info = raceByCode(race.cargo)
  if (info === undefined) throw new Error(`unknown race code ${race.cargo} in the summary`)
  return info
}

function FullResults({
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
        />
      </div>
      <UnderAppealTable locale={locale} results={results} />
      <PartyTable locale={locale} results={results} />
      <TotalsTable locale={locale} results={results} />
    </>
  )
}

/** Brazil as a whole: President, with the state races offered through the state list. */
export function BrazilView({ locale }: { locale: Locale }) {
  const race = getSummary('br').corridas.find((entry) => entry.cargo === 1)
  if (race === undefined) throw new Error('br.json has no presidential race')
  const info = knownRace(race)
  const results = raceResults(race, info.proportional)
  return (
    <PageShell locale={locale} path={`/${YEAR}/`}>
      <h1 className="text-2xl font-semibold">{t(locale, 'brazil.title')}</h1>
      <p className="mt-1 text-sm text-slate-700">{t(locale, 'brazil.intro')}</p>
      <TurnoutSummary locale={locale} results={results} />
      <h2 className="mt-6 text-xl font-semibold">
        {t(locale, 'race.inArea', { race: raceName(info, locale), area: brazil(locale) })}
      </h2>
      <FullResults
        locale={locale}
        info={info}
        results={results}
        caption={t(locale, 'race.inArea', { race: raceName(info, locale), area: brazil(locale) })}
      />
      <StateList locale={locale} />
    </PageShell>
  )
}

function StateList({ locale }: { locale: Locale }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">{t(locale, 'brazil.statesTitle')}</h2>
      <p className="mt-1 text-sm text-slate-700">{t(locale, 'brazil.statesNote')}</p>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {[...STATES, ABROAD].map((state) => (
          <li key={state.code}>
            <Link href={localePath(locale, `/${YEAR}/${state.code}/`)} className="underline">
              {areaName(state, locale)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function areaCrumbs(locale: Locale, area: StateInfo, race?: RaceInfo) {
  const crumbs = [{ label: brazil(locale), path: `/${YEAR}/` }]
  if (race === undefined) return [...crumbs, { label: areaName(area, locale) }]
  return [
    ...crumbs,
    { label: areaName(area, locale), path: `/${YEAR}/${area.code}/` },
    { label: raceName(race, locale) },
  ]
}

/**
 * A state, or votes abroad. Abroad has only President, shown in full. A state shows the
 * leaders of each race, and its full results are one page per race.
 */
export function AreaView({ locale, code }: { locale: Locale; code: string }) {
  const area = areaByCode(code)
  if (area === undefined) notFound()
  const races = getSummary(area.code).corridas
  const first = races[0]
  if (first === undefined) throw new Error(`${area.code}.json has no races`)
  const turnout = raceResults(first, knownRace(first).proportional)
  const abroad = area.code === ABROAD.code

  return (
    <PageShell locale={locale} path={`/${YEAR}/${area.code}/`} crumbs={areaCrumbs(locale, area)}>
      <h1 className="text-2xl font-semibold">{areaName(area, locale)}</h1>
      <p className="mt-1 text-sm text-slate-700">
        {t(locale, abroad ? 'area.abroadIntro' : 'area.intro')}
      </p>
      <TurnoutSummary locale={locale} results={turnout} />
      {races.map((race) => {
        const info = knownRace(race)
        const results = raceResults(race, info.proportional)
        const title = raceName(info, locale)
        if (abroad) {
          return (
            <section key={race.cargo} className="mt-6">
              <h2 className="text-xl font-semibold">{title}</h2>
              <FullResults locale={locale} info={info} results={results} caption={title} />
            </section>
          )
        }
        const size = info.proportional ? HEADLINE_SIZE.proportional : HEADLINE_SIZE.majoritarian
        const elected = results.candidates.filter((candidate) => isElected(candidate.outcome))
        return (
          <section key={race.cargo} className="mt-6" data-race={info.slug}>
            <h2 className="text-xl font-semibold">{title}</h2>
            <RaceNote locale={locale} info={info} results={results} />
            {info.proportional && elected.length > 0 && (
              <p className="mt-1 text-sm text-slate-700">
                {t(locale, 'area.electedCount', { count: String(elected.length) })}
              </p>
            )}
            <div className="mt-2">
              <CandidateTable
                locale={locale}
                candidates={results.candidates.slice(0, size)}
                validVotes={results.totals.valid}
                caption={t(locale, 'area.leadersCaption', { race: title })}
              />
            </div>
            <p className="mt-2 text-sm">
              {/* A deputy race's page carries over a megabyte of data, too much to prefetch. */}
              <Link
                href={localePath(locale, `/${YEAR}/${area.code}/${info.slug}/`)}
                prefetch={false}
                className="underline"
              >
                {t(locale, 'area.fullResults', {
                  count: formatInteger(locale, results.candidates.length),
                })}
              </Link>
            </p>
          </section>
        )
      })}
    </PageShell>
  )
}

/** Every candidate of one race in one state. */
export function RaceView({ locale, code, slug }: { locale: Locale; code: string; slug: string }) {
  const area = areaByCode(code)
  const info = raceBySlug(slug)
  if (area === undefined || info === undefined) notFound()
  const race = getSummary(area.code).corridas.find((entry) => entry.cargo === info.code)
  if (race === undefined) notFound()
  const results = raceResults(race, info.proportional)
  const title = t(locale, 'race.inArea', {
    race: raceName(info, locale),
    area: areaName(area, locale),
  })
  return (
    <PageShell
      locale={locale}
      path={`/${YEAR}/${area.code}/${info.slug}/`}
      crumbs={areaCrumbs(locale, area, info)}
    >
      <h1 className="text-2xl font-semibold">{title}</h1>
      <FullResults locale={locale} info={info} results={results} caption={title} />
    </PageShell>
  )
}

export function raceSlugs(code: string): string[] {
  return raceSlugsOf(getSummary(code))
}

export function pageTitle(locale: Locale, code?: string, slug?: string): string {
  const area = code === undefined ? undefined : areaByCode(code)
  const race = slug === undefined ? undefined : raceBySlug(slug)
  if (area !== undefined && race !== undefined) {
    return t(locale, 'race.inArea', { race: raceName(race, locale), area: areaName(area, locale) })
  }
  if (area !== undefined) return areaName(area, locale)
  return t(locale, 'brazil.title')
}
