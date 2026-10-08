import { notFound } from 'next/navigation'
import { AppLink } from '@/components/app-link'
import { PageShell, type Crumb } from '@/components/page-shell'
import { Outcome } from '@/components/results'
import { coveredAreas, getSummary } from '@/lib/data'
import {
  ABROAD,
  areaByCode,
  areaName,
  CANDIDATE_PAGE_RACES,
  candidatePath,
  PRESIDENT,
  raceByCode,
  raceBySlug,
  raceName,
  YEAR,
  type RaceInfo,
} from '@/lib/elections'
import { formatInteger, formatShare, localePath, t, type Locale } from '@/lib/i18n'
import { VALID, type SummaryCandidate, type SummaryRace } from '@/lib/results'
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

/** One President, Governor or Senate candidacy: its results, and its share by municipality. */
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

  return (
    <PageShell
      locale={locale}
      path={candidatePath(race, candidacy.area, candidate.numero)}
      crumbs={crumbs(locale, candidacy)}
    >
      <h1 className="text-2xl font-semibold break-words">{candidate.nome}</h1>
      <p className="mt-1 text-sm text-slate-700">
        {candidate.partido} · {candidate.numero} ·{' '}
        {t(locale, 'race.inArea', { race: raceName(race, locale), area: where })}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2 rounded bg-slate-50 p-3 text-sm">
        <div>
          <dt className="text-xs text-slate-600">{t(locale, 'results.votes')}</dt>
          <dd className="font-medium tabular-nums" data-testid="candidate-votes">
            {formatInteger(locale, candidate.votos)}
          </dd>
        </div>
        {valid && (
          <div>
            <dt className="text-xs text-slate-600">{t(locale, 'candidate.share')}</dt>
            <dd className="font-medium tabular-nums">
              {formatShare(locale, candidate.votos, summary.validos)}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-slate-600">{t(locale, 'candidate.outcome')}</dt>
          <dd>
            <Outcome locale={locale} outcome={candidate.resultado} />
          </dd>
        </div>
      </dl>
      {!valid && (
        <p className="mt-3 text-sm text-slate-700" data-testid="under-appeal">
          {t(locale, 'candidate.underAppeal', { status: candidate.destino })}
        </p>
      )}
      {valid && summary.escolhas_por_eleitor > 1 && (
        <p className="mt-3 text-sm text-slate-700">{t(locale, 'candidate.twoChoices')}</p>
      )}
      {valid && !mapped && (
        <p className="mt-3 text-sm text-slate-700">{t(locale, 'candidate.oneMunicipality')}</p>
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
        <p className="mt-4 text-sm text-slate-700" data-testid="abroad-note">
          {t(locale, 'candidate.abroadNote')}{' '}
          <AppLink href={localePath(locale, `/${YEAR}/${ABROAD.code}/`)} className="underline">
            {t(locale, 'brazil.abroadLink')}
          </AppLink>
        </p>
      )}
      <p className="mt-6 text-sm">
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
