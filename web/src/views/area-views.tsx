import { notFound } from 'next/navigation'
import { AppLink } from '@/components/app-link'
import { FullResults, RaceNote } from '@/components/race-results'
import { CandidateTable, EligibleGapNote } from '@/components/results'
import { PageShell } from '@/components/page-shell'
import { getMunicipalities, getSummary } from '@/lib/data'
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
import { hasMap, MapSection } from '@/views/map-section'
import {
  isElected,
  raceResults,
  raceSlugsOf,
  type RaceResults,
  type SummaryRace,
} from '@/lib/results'

const HEADLINE_SIZE = { majoritarian: 3, proportional: 5 }
const GOVERNOR = 3

function brazil(locale: Locale): string {
  return t(locale, 'area.brazil')
}

/** Turnout differs between races, for example through voters in transit, so it names its race. */
function TurnoutSummary({
  locale,
  info,
  results,
}: {
  locale: Locale
  info: RaceInfo
  results: RaceResults
}) {
  const totals = results.totals
  return (
    <section className="mt-3 rounded bg-slate-50 p-3">
      <h2 className="text-xs font-medium text-slate-600">
        {t(locale, 'area.turnoutTitle', { race: raceName(info, locale) })}
      </h2>
      <dl className="mt-1 grid grid-cols-3 gap-2 text-sm">
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
      <EligibleGapNote locale={locale} results={results} />
    </section>
  )
}

function knownRace(race: SummaryRace): RaceInfo {
  const info = raceByCode(race.cargo)
  if (info === undefined) throw new Error(`unknown race code ${race.cargo} in the summary`)
  return info
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
      <TurnoutSummary locale={locale} info={info} results={results} />
      <h2 className="mt-6 text-xl font-semibold">
        {t(locale, 'race.inArea', { race: raceName(info, locale), area: brazil(locale) })}
      </h2>
      <FullResults
        locale={locale}
        info={info}
        results={results}
        caption={t(locale, 'race.inArea', { race: raceName(info, locale), area: brazil(locale) })}
      />
      <MapSection locale={locale} area="br" areaLabel={brazil(locale)} race={info} table={false} />
      <p className="mt-4 text-sm">
        <AppLink href={localePath(locale, `/${YEAR}/${ABROAD.code}/`)} className="underline">
          {t(locale, 'brazil.abroadLink')}
        </AppLink>
      </p>
      <StateList locale={locale} president={info} />
    </PageShell>
  )
}

function StateList({ locale, president }: { locale: Locale; president: RaceInfo }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">{t(locale, 'brazil.statesTitle')}</h2>
      <p className="mt-1 text-sm text-slate-700">{t(locale, 'brazil.statesNote')}</p>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {STATES.map((state) => (
          <li key={state.code}>
            <AppLink href={localePath(locale, `/${YEAR}/${state.code}/`)} className="underline">
              {areaName(state, locale)}
            </AppLink>
            <AppLink
              href={localePath(locale, `/${YEAR}/${state.code}/${president.slug}/`)}
              className="block text-xs text-slate-600 underline"
            >
              {t(locale, 'brazil.statePresident')}
            </AppLink>
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
  const firstInfo = knownRace(first)
  const turnout = raceResults(first, firstInfo.proportional)
  const abroad = area.code === ABROAD.code
  const governor = races.some((race) => race.cargo === GOVERNOR) ? raceByCode(GOVERNOR) : undefined

  return (
    <PageShell locale={locale} path={`/${YEAR}/${area.code}/`} crumbs={areaCrumbs(locale, area)}>
      <h1 className="text-2xl font-semibold">{areaName(area, locale)}</h1>
      <p className="mt-1 text-sm text-slate-700">
        {t(locale, abroad ? 'area.abroadIntro' : 'area.intro')}
      </p>
      <TurnoutSummary locale={locale} info={firstInfo} results={turnout} />
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
          </section>
        )
      })}
      {hasMap(area.code) && governor !== undefined ? (
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
      ) : (
        <MunicipalityList locale={locale} area={area} />
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
          <FullResults locale={locale} info={info} results={results} caption={title} />
        </MapSection>
      ) : (
        <FullResults locale={locale} info={info} results={results} caption={title} />
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
