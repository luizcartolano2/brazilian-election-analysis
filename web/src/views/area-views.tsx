import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { AppLink } from '@/components/app-link'
import { FullResults, RaceNote } from '@/components/race-results'
import { ResultCards } from '@/components/result-cards'
import { EligibleGapNote } from '@/components/results'
import { PageShell } from '@/components/page-shell'
import { RaceTabs, type RacePanel } from '@/components/race-tabs'
import { getMunicipalities, getSummary } from '@/lib/data'
import {
  ABROAD,
  areaByCode,
  CANDIDATE_PAGE_RACES,
  candidatePath,
  areaName,
  PRESIDENT,
  proportionalRaces,
  raceByCode,
  raceBySlug,
  raceName,
  YEAR,
  type RaceInfo,
  type StateInfo,
} from '@/lib/elections'
import { headlineText, raceHeadline } from '@/lib/headline'
import { formatInteger, formatShare, localePath, t, type Locale } from '@/lib/i18n'
import { candidateRanks } from '@/lib/maps'
import {
  isElected,
  raceResults,
  raceSlugsOf,
  type RaceResults,
  type SummaryRace,
} from '@/lib/results'
import { ClosestMunicipalities } from '@/views/closest-municipalities'
import { hasMap, MapSection } from '@/views/map-section'
import { StateTiles } from '@/views/state-tiles'

const GOVERNOR = 3
// The order of a state page's tabs. The deputy races follow them as links.
const TAB_RACES = [GOVERNOR, 5, PRESIDENT]

function brazil(locale: Locale): string {
  return t(locale, 'area.brazil')
}

/** Turnout differs between races, for example through voters in transit, so it names its race. */
function TurnoutSummary({
  locale,
  info,
  results,
  heading: Heading = 'h3',
}: {
  locale: Locale
  info: RaceInfo
  results: RaceResults
  /** The level that follows the caller's own headings. */
  heading?: 'h2' | 'h3'
}) {
  const totals = results.totals
  const stats = [
    { key: 'totals.eligible', value: totals.eligible, share: null },
    {
      key: 'totals.attendance',
      value: totals.attendance,
      share: formatShare(locale, totals.attendance, totals.eligible),
    },
    {
      key: 'totals.abstention',
      value: totals.abstention,
      share: formatShare(locale, totals.abstention, totals.eligible),
    },
  ] as const
  return (
    <section className="bg-surface mt-5 rounded-2xl p-4">
      <Heading className="text-muted font-sans text-sm font-semibold">
        {t(locale, 'area.turnoutTitle', { race: raceName(info, locale) })}
      </Heading>
      <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.key}>
            <dt className="text-muted text-xs">{t(locale, stat.key)}</dt>
            <dd className="font-display text-xl font-bold tabular-nums sm:text-2xl">
              {formatInteger(locale, stat.value)}
              {stat.share !== null && (
                <span className="text-muted block font-sans text-xs font-normal">{stat.share}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <EligibleGapNote locale={locale} results={results} />
    </section>
  )
}

/** Links each candidacy of the races that have candidate pages to its page. */
function candidateHref(
  locale: Locale,
  race: RaceInfo,
  area: string,
): ((number: number) => string) | undefined {
  if (!CANDIDATE_PAGE_RACES.has(race.code)) return undefined
  return (number) => localePath(locale, candidatePath(race, area, number))
}

function knownRace(race: SummaryRace): RaceInfo {
  const info = raceByCode(race.cargo)
  if (info === undefined) throw new Error(`unknown race code ${race.cargo} in the summary`)
  return info
}

function brazilPresident(): SummaryRace {
  const race = getSummary('br').corridas.find((entry) => entry.cargo === PRESIDENT)
  if (race === undefined) throw new Error('br.json has no presidential race')
  return race
}

/** A majoritarian race's map colors: Brazil's ranking for President, the state's otherwise. */
function ranksOf(race: SummaryRace): ReadonlyMap<number, 0 | 1> {
  return candidateRanks(race, race.cargo === PRESIDENT ? brazilPresident() : race)
}

function headlineOf(locale: Locale, info: RaceInfo, results: RaceResults): string {
  const headline = raceHeadline(results, info.proportional)
  return headline === null
    ? raceName(info, locale)
    : headlineText(locale, headline, raceName(info, locale))
}

/** Brazil as a whole: President, with the state races offered through the state tiles. */
export function BrazilView({ locale }: { locale: Locale }) {
  const race = brazilPresident()
  const info = knownRace(race)
  const results = raceResults(race, info.proportional)
  const ranks = ranksOf(race)
  return (
    <PageShell locale={locale} path={`/${YEAR}/`} wide>
      <p className="text-muted text-xs font-bold tracking-widest uppercase">
        {t(locale, 'race.inArea', { race: raceName(info, locale), area: brazil(locale) })}
      </p>
      <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">
        {headlineOf(locale, info, results)}
      </h1>
      <p className="text-muted mt-2 text-sm">{t(locale, 'brazil.intro')}</p>
      <ResultCards
        locale={locale}
        results={results}
        ranks={ranks}
        candidateHref={candidateHref(locale, info, 'br')}
      />
      <TurnoutSummary locale={locale} info={info} results={results} heading="h2" />
      <div className="mt-2 grid items-start gap-x-8 lg:grid-cols-[3fr_2fr]">
        <MapSection
          locale={locale}
          area="br"
          areaLabel={brazil(locale)}
          race={info}
          table={false}
        />
        <div className="mt-8">
          <StateTiles locale={locale} />
        </div>
      </div>
      <section className="mt-10">
        <h2 className="text-2xl font-extrabold">{t(locale, 'brazil.fullResultsTitle')}</h2>
        <FullResults
          locale={locale}
          info={info}
          results={results}
          caption={t(locale, 'race.inArea', { race: raceName(info, locale), area: brazil(locale) })}
          candidateHref={candidateHref(locale, info, 'br')}
          ranks={ranks}
        />
      </section>
      <p className="mt-6 text-sm">
        <AppLink href={localePath(locale, `/${YEAR}/${ABROAD.code}/`)} className="underline">
          {t(locale, 'brazil.abroadLink')}
        </AppLink>
      </p>
    </PageShell>
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

/** One majoritarian race of a state: its headline, cards, turnout and a link to all candidates. */
function RacePanelContent({
  locale,
  area,
  race,
  children,
}: {
  locale: Locale
  area: StateInfo
  race: SummaryRace
  children?: ReactNode
}) {
  const info = knownRace(race)
  const results = raceResults(race, info.proportional)
  return (
    <>
      <h2 className="text-muted text-xs font-bold tracking-widest uppercase">
        {raceName(info, locale)}
      </h2>
      <h3 className="mt-2 text-3xl font-extrabold sm:text-4xl" data-testid="headline">
        {headlineOf(locale, info, results)}
      </h3>
      <RaceNote locale={locale} info={info} results={results} />
      <ResultCards
        locale={locale}
        results={results}
        ranks={ranksOf(race)}
        candidateHref={candidateHref(locale, info, area.code)}
      />
      <TurnoutSummary locale={locale} info={info} results={results} />
      <p className="mt-4 text-sm font-semibold">
        <AppLink
          href={localePath(locale, `/${YEAR}/${area.code}/${info.slug}/`)}
          className="underline"
        >
          {t(locale, 'area.fullResults', {
            count: formatInteger(
              locale,
              results.candidates.length + results.candidatesUnderAppeal.length,
            ),
          })}
        </AppLink>
      </p>
      {children}
    </>
  )
}

/** The votes cast abroad: President only, in full, with no tabs. */
function AbroadView({ locale, area }: { locale: Locale; area: StateInfo }) {
  const race = getSummary(area.code).corridas.find((entry) => entry.cargo === PRESIDENT)
  if (race === undefined) throw new Error(`${area.code}.json has no presidential race`)
  const info = knownRace(race)
  const results = raceResults(race, info.proportional)
  const ranks = ranksOf(race)
  return (
    <PageShell
      locale={locale}
      path={`/${YEAR}/${area.code}/`}
      crumbs={areaCrumbs(locale, area)}
      wide
    >
      <h1 className="text-4xl font-extrabold">{areaName(area, locale)}</h1>
      <p className="text-muted mt-2 text-sm">{t(locale, 'area.abroadIntro')}</p>
      <h2 className="mt-6 text-3xl font-extrabold" data-testid="headline">
        {headlineOf(locale, info, results)}
      </h2>
      <ResultCards
        locale={locale}
        results={results}
        ranks={ranks}
        candidateHref={candidateHref(locale, info, area.code)}
      />
      <TurnoutSummary locale={locale} info={info} results={results} />
      <section className="mt-10" data-race={info.slug}>
        <h2 className="text-2xl font-extrabold">{raceName(info, locale)}</h2>
        <FullResults
          locale={locale}
          info={info}
          results={results}
          caption={raceName(info, locale)}
          candidateHref={candidateHref(locale, info, area.code)}
          ranks={ranks}
        />
      </section>
      <MunicipalityList locale={locale} area={area} />
    </PageShell>
  )
}

/**
 * A state, or the votes cast abroad. A state shows Governor, Senate and President as tabs, with
 * the Governor map, and links to its deputy races, whose full results are their own pages.
 */
export function AreaView({ locale, code }: { locale: Locale; code: string }) {
  const area = areaByCode(code)
  if (area === undefined) notFound()
  if (area.code === ABROAD.code) return <AbroadView locale={locale} area={area} />
  const races = getSummary(area.code).corridas
  const governor = raceByCode(GOVERNOR)

  const panels: RacePanel[] = TAB_RACES.flatMap((cargo) => {
    const race = races.find((entry) => entry.cargo === cargo)
    if (race === undefined) return []
    const info = knownRace(race)
    const extra =
      cargo === GOVERNOR && governor !== undefined ? (
        hasMap(area.code) ? (
          <div className="grid items-start gap-x-8 lg:grid-cols-[3fr_2fr]">
            <MapSection
              locale={locale}
              area={area.code}
              areaLabel={areaName(area, locale)}
              race={governor}
              table
              collapsed={t(locale, 'area.municipalitiesSummary', {
                count: formatInteger(locale, getMunicipalities(area.code).length),
              })}
            />
            <ClosestMunicipalities locale={locale} area={area.code} race={governor} />
          </div>
        ) : (
          <MunicipalityList locale={locale} area={area} />
        )
      ) : null
    return [
      {
        slug: info.slug,
        label: raceName(info, locale),
        content: (
          <RacePanelContent locale={locale} area={area} race={race}>
            {extra}
          </RacePanelContent>
        ),
      },
    ]
  })
  const deputies = proportionalRaces(races.map((race) => race.cargo)).map((info) => {
    const race = races.find((entry) => entry.cargo === info.code) as SummaryRace
    const candidates = raceResults(race, info.proportional).candidates
    return {
      info,
      elected: candidates.filter((candidate) => isElected(candidate.outcome)).length,
      leader: candidates[0]?.name,
    }
  })

  return (
    <PageShell
      locale={locale}
      path={`/${YEAR}/${area.code}/`}
      crumbs={areaCrumbs(locale, area)}
      wide
    >
      <h1 className="text-4xl font-extrabold sm:text-5xl">{areaName(area, locale)}</h1>
      <p className="text-muted mt-2 text-sm">{t(locale, 'area.intro')}</p>
      <RaceTabs
        label={t(locale, 'area.racesLabel', { area: areaName(area, locale) })}
        panels={panels}
      />
      {deputies.length > 0 && (
        <section className="mt-10" data-testid="deputies">
          <h2 className="text-2xl font-extrabold">{t(locale, 'area.deputiesTitle')}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {deputies.map(({ info, elected, leader }) => (
              <li key={info.slug}>
                <AppLink
                  href={localePath(locale, `/${YEAR}/${area.code}/${info.slug}/`)}
                  className="border-line flex h-full flex-col gap-1 rounded-2xl border p-4"
                  data-race={info.slug}
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 font-semibold">
                    <span className="underline">{raceName(info, locale)}</span>
                    {elected > 0 && (
                      <span className="text-muted text-sm font-normal">
                        {t(locale, 'area.electedCount', { count: formatInteger(locale, elected) })}
                      </span>
                    )}
                  </span>
                  {leader !== undefined && (
                    <span className="text-muted text-sm">
                      {t(locale, 'map.leader')}: <span>{leader}</span>
                    </span>
                  )}
                </AppLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  )
}

function MunicipalityList({ locale, area }: { locale: Locale; area: StateInfo }) {
  const municipalities = getMunicipalities(area.code)
  if (municipalities.length === 0) return null
  const abroad = area.code === ABROAD.code
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">
        {t(locale, abroad ? 'area.citiesTitle' : 'area.municipalitiesTitle')}
      </h2>
      <details className="mt-2">
        <summary className="cursor-pointer text-sm underline">
          {t(locale, abroad ? 'area.citiesSummary' : 'area.municipalitiesSummary', {
            count: formatInteger(locale, municipalities.length),
          })}
        </summary>
        <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {municipalities.map((municipality) => (
            <li key={municipality.municipio} className="break-words">
              <AppLink
                href={`${localePath(locale, `/${YEAR}/municipio/`)}?uf=${area.code}&mu=${municipality.municipio}`}
                className="underline"
              >
                {municipality.nome}
              </AppLink>
            </li>
          ))}
        </ul>
      </details>
    </section>
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
      {hasMap(area.code) ? (
        <MapSection
          locale={locale}
          area={area.code}
          areaLabel={areaName(area, locale)}
          race={info}
          table
        >
          <h2 className="mt-8 text-xl font-semibold">{t(locale, 'race.candidatesTitle')}</h2>
          <FullResults
            locale={locale}
            info={info}
            results={results}
            caption={title}
            candidateHref={candidateHref(locale, info, area.code)}
          />
        </MapSection>
      ) : (
        <FullResults
          locale={locale}
          info={info}
          results={results}
          caption={title}
          candidateHref={candidateHref(locale, info, area.code)}
        />
      )}
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
