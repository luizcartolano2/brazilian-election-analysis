import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { AppLink } from '@/components/app-link'
import { PageShell, type Crumb } from '@/components/page-shell'
import { Outcome } from '@/components/results'
import { placeOf, sharesByState, type StateShare } from '@/lib/candidates'
import { coveredAreas, getCandidateVotes, getSummary } from '@/lib/data'
import {
  ABROAD,
  areaByCode,
  areaName,
  areaOfIbge,
  CANDIDATE_PAGE_RACES,
  candidatePath,
  PRESIDENT,
  raceByCode,
  raceBySlug,
  raceName,
  YEAR,
  type RaceInfo,
} from '@/lib/elections'
import { candidateHeadline, candidateHeadlineText } from '@/lib/headline'
import { formatInteger, formatOrdinal, formatShare, localePath, t, type Locale } from '@/lib/i18n'
import { candidateColor } from '@/lib/map-colors'
import { candidateRanks, largestMunicipalities } from '@/lib/maps'
import { raceResults, VALID, type SummaryCandidate, type SummaryRace } from '@/lib/results'
import { hasMap, ShareMapSection } from '@/views/map-section'

interface Candidacy {
  race: RaceInfo
  /** `br` for President, or a state's code. */
  area: string
  summary: SummaryRace
  candidate: SummaryCandidate
}

function findCandidacy(area: string, slug: string, numero: string): Candidacy | undefined {
  const race = raceBySlug(slug)
  if (race === undefined || !CANDIDATE_PAGE_RACES.has(race.code) || !/^[0-9]{1,5}$/.test(numero)) {
    return undefined
  }
  const summaryArea = race.code === PRESIDENT ? 'br' : area
  if (summaryArea !== 'br' && areaByCode(summaryArea) === undefined) return undefined
  const summary = getSummary(summaryArea).corridas.find((entry) => entry.cargo === race.code)
  const candidate = summary?.candidatos.find((entry) => entry.numero === Number(numero))
  if (summary === undefined || candidate === undefined) return undefined
  return { race, area: summaryArea, summary, candidate }
}

function areaLabel(locale: Locale, area: string): string {
  const info = areaByCode(area)
  return info === undefined ? t(locale, 'area.brazil') : areaName(info, locale)
}

/** The race page that lists every candidate: the Brazil page for President. */
function racePagePath(candidacy: Candidacy): string {
  return candidacy.race.code === PRESIDENT
    ? `/${YEAR}/`
    : `/${YEAR}/${candidacy.area}/${candidacy.race.slug}/`
}

function crumbs(locale: Locale, candidacy: Candidacy): Crumb[] {
  const brazil = { label: t(locale, 'area.brazil'), path: `/${YEAR}/` }
  const name = { label: candidacy.candidate.nome }
  if (candidacy.race.code === PRESIDENT) return [brazil, name]
  return [
    brazil,
    { label: areaLabel(locale, candidacy.area), path: `/${YEAR}/${candidacy.area}/` },
    { label: raceName(candidacy.race, locale), path: racePagePath(candidacy) },
    name,
  ]
}

const LARGEST = 6

function Stat({
  label,
  children,
  testId,
}: {
  label: string
  children: ReactNode
  testId?: string
}) {
  return (
    <div className="bg-surface rounded-2xl p-4">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="font-display mt-1 text-2xl font-bold tabular-nums" data-testid={testId}>
        {children}
      </dd>
    </div>
  )
}

function municipalityHref(locale: Locale, area: string, municipio: number, race: RaceInfo) {
  return `${localePath(locale, `/${YEAR}/municipio/`)}?uf=${area}&mu=${municipio}&cargo=${race.slug}`
}

/** The area's municipalities with the most valid votes, with the candidate's share in each. */
function LargestMunicipalities({ locale, candidacy }: { locale: Locale; candidacy: Candidacy }) {
  const { race, candidate } = candidacy
  const rows = largestMunicipalities(
    getCandidateVotes(candidacy.area, race.code),
    candidate.numero,
    LARGEST,
  )
  if (rows.length === 0) return null
  return (
    <section data-testid="largest">
      <h2 className="text-2xl font-extrabold">{t(locale, 'candidate.largestTitle')}</h2>
      <p className="text-muted mt-1 text-sm">
        {t(locale, 'candidate.largestNote', { name: candidate.nome })}
      </p>
      <table className="mt-3 w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">{t(locale, 'candidate.largestTitle')}</caption>
        <thead>
          <tr className="border-ink/20 text-muted border-b text-left text-xs">
            <th scope="col" className="py-1 pr-2 font-medium">
              {t(locale, 'map.municipality')}
            </th>
            <th scope="col" className="w-20 py-1 text-right font-medium">
              %
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const area = candidacy.area === 'br' ? (areaOfIbge(row.ibge) ?? '') : candidacy.area
            return (
              <tr key={row.municipio} className="border-line border-b">
                <td className="py-1.5 pr-2 break-words">
                  <AppLink
                    href={municipalityHref(locale, area, row.municipio, race)}
                    className="underline"
                  >
                    {row.nome}
                  </AppLink>
                  {candidacy.area === 'br' && (
                    <span className="text-muted"> · {area.toUpperCase()}</span>
                  )}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatShare(locale, row.votes, row.valid)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function presidentStates(numero: number) {
  const states = coveredAreas()
    .filter((area) => area !== 'br' && area !== ABROAD.code)
    .flatMap((area) => {
      const race = getSummary(area).corridas.find((entry) => entry.cargo === PRESIDENT)
      return race === undefined ? [] : [{ area, results: raceResults(race, false) }]
    })
  return sharesByState(states, numero)
}

/** A President candidate's share in each state, from the highest, with the states it led marked. */
function StateShares({
  locale,
  name,
  shares,
}: {
  locale: Locale
  name: string
  shares: StateShare[]
}) {
  return (
    <section data-testid="state-shares">
      <h2 className="text-2xl font-extrabold">{t(locale, 'candidate.statesTitle')}</h2>
      <p className="text-muted mt-1 text-sm">{t(locale, 'candidate.statesNote', { name })}</p>
      <table className="mt-3 w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">{t(locale, 'candidate.statesTitle')}</caption>
        <thead>
          <tr className="border-ink/20 text-muted border-b text-left text-xs">
            <th scope="col" className="py-1 pr-2 font-medium">
              {t(locale, 'tiles.state')}
            </th>
            <th scope="col" className="w-20 py-1 text-right font-medium">
              %
            </th>
          </tr>
        </thead>
        <tbody>
          {shares.map((share) => {
            const state = areaByCode(share.area)
            return (
              <tr key={share.area} className="border-line border-b">
                <td className="py-1.5 pr-2">
                  <AppLink
                    href={localePath(locale, `/${YEAR}/${share.area}/`)}
                    className="underline"
                  >
                    {state === undefined ? share.area.toUpperCase() : areaName(state, locale)}
                  </AppLink>
                  {share.led && (
                    <span className="bg-surface ml-2 rounded-full px-2 py-0.5 text-xs font-semibold">
                      {t(locale, 'candidate.ledMark')}
                    </span>
                  )}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatShare(locale, share.votes, share.valid)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

/** One President, Governor or Senate candidacy: its outcome, place, share map and largest places. */
export function CandidateView({
  locale,
  area,
  slug,
  numero,
}: {
  locale: Locale
  area: string
  slug: string
  numero: string
}) {
  const candidacy = findCandidacy(area, slug, numero)
  if (candidacy === undefined) notFound()
  const { race, summary, candidate } = candidacy
  const valid = candidate.destino === VALID
  const where = areaLabel(locale, candidacy.area)
  const mapped = valid && (candidacy.area === 'br' || hasMap(candidacy.area))
  const place = valid ? placeOf(raceResults(summary, false), candidate.numero) : null
  const headline = candidateHeadline(candidate, place, race.code)
  const rank = candidateRanks(summary).get(candidate.numero)
  const shares = valid && race.code === PRESIDENT ? presidentStates(candidate.numero) : null
  const led = shares?.filter((share) => share.led).length ?? 0

  return (
    <PageShell
      locale={locale}
      path={candidatePath(race, candidacy.area, candidate.numero)}
      crumbs={crumbs(locale, candidacy)}
      wide
    >
      <p className="text-muted text-xs font-bold tracking-widest uppercase">
        {t(locale, 'race.inArea', { race: raceName(race, locale), area: where })}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-full"
          style={{
            background: candidateColor(valid ? rank : undefined, summary.escolhas_por_eleitor > 1),
          }}
        />
        <h1 className="text-4xl font-extrabold break-words sm:text-5xl">{candidate.nome}</h1>
      </div>
      <p className="text-muted mt-1">
        {candidate.partido} · {candidate.numero}
      </p>
      <h2 className="mt-4 text-2xl font-extrabold sm:text-3xl" data-testid="headline">
        {candidateHeadlineText(locale, headline)}
      </h2>
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
        <Stat label={t(locale, 'results.votes')} testId="candidate-votes">
          {formatInteger(locale, candidate.votos)}
        </Stat>
        {valid && (
          <Stat label={t(locale, 'candidate.share')}>
            {formatShare(locale, candidate.votos, summary.validos)}
          </Stat>
        )}
        {place !== null && (
          <Stat label={t(locale, 'candidate.place')} testId="candidate-place">
            {t(locale, 'candidate.placeValue', { place: formatOrdinal(locale, place) })}
          </Stat>
        )}
        {shares !== null && (
          <Stat label={t(locale, 'candidate.statesLed')} testId="states-led">
            {t(locale, led === 1 ? 'candidate.statesOne' : 'candidate.statesMany', {
              count: formatInteger(locale, led),
            })}
          </Stat>
        )}
        <Stat label={t(locale, 'candidate.outcome')}>
          <span className="font-sans text-base font-normal">
            <Outcome locale={locale} outcome={candidate.resultado} />
          </span>
        </Stat>
      </dl>
      {!valid && (
        <p className="text-muted mt-4 text-sm" data-testid="under-appeal">
          {t(locale, 'candidate.underAppeal', { status: candidate.destino })}
        </p>
      )}
      {valid && summary.escolhas_por_eleitor > 1 && (
        <p className="text-muted mt-4 text-sm">{t(locale, 'candidate.twoChoices')}</p>
      )}
      {valid && !mapped && (
        <p className="text-muted mt-4 text-sm">{t(locale, 'candidate.oneMunicipality')}</p>
      )}
      {mapped && (
        <ShareMapSection
          locale={locale}
          area={candidacy.area}
          areaLabel={where}
          race={race}
          numero={candidate.numero}
          name={candidate.nome}
          choicesPerVoter={summary.escolhas_por_eleitor}
        />
      )}
      {mapped && race.code === PRESIDENT && (
        <p className="text-muted mt-4 text-sm" data-testid="abroad-note">
          {t(locale, 'candidate.abroadNote')}{' '}
          <AppLink href={localePath(locale, `/${YEAR}/${ABROAD.code}/`)} className="underline">
            {t(locale, 'brazil.abroadLink')}
          </AppLink>
        </p>
      )}
      {mapped && (
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-2">
          <LargestMunicipalities locale={locale} candidacy={candidacy} />
          {shares !== null && <StateShares locale={locale} name={candidate.nome} shares={shares} />}
        </div>
      )}
      <p className="mt-8 text-sm font-semibold">
        <AppLink href={localePath(locale, racePagePath(candidacy))} className="underline">
          {t(locale, 'candidate.allCandidates', { race: raceName(race, locale), area: where })}
        </AppLink>
      </p>
    </PageShell>
  )
}

export function candidateTitle(locale: Locale, area: string, slug: string, numero: string): string {
  const candidacy = findCandidacy(area, slug, numero)
  if (candidacy === undefined) return t(locale, 'brazil.title')
  return `${candidacy.candidate.nome} · ${raceName(candidacy.race, locale)} · ${areaLabel(locale, candidacy.area)}`
}

export function candidatePagePath(area: string, slug: string, numero: string): string {
  const race = raceBySlug(slug)
  return race === undefined
    ? `/${YEAR}/`
    : candidatePath(race, race.code === PRESIDENT ? 'br' : area, Number(numero))
}

export type PresidentParams = Promise<{ numero: string }>
export type CandidateParams = Promise<{ uf: string; cargo: string; numero: string }>

/** Every President candidacy in Brazil's summary. */
export function presidentParams(): { numero: string }[] {
  const race = getSummary('br').corridas.find((entry) => entry.cargo === PRESIDENT)
  return (race?.candidatos ?? []).map((candidate) => ({ numero: String(candidate.numero) }))
}

/** Every Governor and Senate candidacy in each state's summary. */
export function candidateParams(): { uf: string; cargo: string; numero: string }[] {
  return coveredAreas()
    .filter((uf) => uf !== ABROAD.code)
    .flatMap((uf) =>
      getSummary(uf)
        .corridas.filter((race) => race.cargo !== PRESIDENT && CANDIDATE_PAGE_RACES.has(race.cargo))
        .flatMap((race) =>
          race.candidatos.map((candidate) => ({
            uf,
            cargo: raceByCode(race.cargo)?.slug ?? '',
            numero: String(candidate.numero),
          })),
        ),
    )
}
