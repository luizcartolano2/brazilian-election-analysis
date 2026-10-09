/** The municipality, zone and station views of a round, or its waiting content before a pin. */
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Drilldown } from '@/components/drilldown'
import { PageShell, type RoundLinks } from '@/components/page-shell'
import type { Level } from '@/lib/address'
import { getDrilldownConfig, hasRound } from '@/lib/data'
import { YEAR, type Round } from '@/lib/elections'
import { t, type Locale, type MessageKey } from '@/lib/i18n'
import { roundPath } from '@/lib/paths'
import { pageMetadata } from '@/views/metadata'
import { WaitingContent } from '@/views/waiting'

const TITLES: Record<Level, MessageKey> = {
  municipio: 'drilldown.municipalityTitle',
  zona: 'drilldown.zoneTitle',
  secao: 'drilldown.stationTitle',
}

function viewPath(level: Level, round: Round): string {
  return roundPath(round, `/${YEAR}/${level}/`)
}

export function drilldownMetadata(locale: Locale, level: Level, round: Round): Metadata {
  const title = t(locale, TITLES[level])
  return pageMetadata(
    locale,
    viewPath(level, round),
    round === 1 ? title : `${title} · ${t(locale, 'site.secondRound')}`,
  )
}

export function DrilldownPage({
  locale,
  level,
  round,
}: {
  locale: Locale
  level: Level
  round: Round
}) {
  // The header's other round keeps the place, and drops a race that the round does not hold.
  const races = (other: Round) => (hasRound(other) ? getDrilldownConfig(other).areaRaces : null)
  const roundLinks: RoundLinks = {
    current: round,
    hrefs: { 1: viewPath(level, 1), 2: viewPath(level, 2) },
    drilldownRaces: { 1: races(1), 2: races(2) },
  }
  return (
    <PageShell
      locale={locale}
      path={viewPath(level, round)}
      round={round}
      roundLinks={roundLinks}
      wide
    >
      {hasRound(round) ? (
        <>
          <noscript>
            <p className="text-sm">{t(locale, 'drilldown.noScript')}</p>
          </noscript>
          <Suspense fallback={<p className="text-sm">{t(locale, 'drilldown.loading')}</p>}>
            <Drilldown locale={locale} level={level} config={getDrilldownConfig(round)} />
          </Suspense>
        </>
      ) : (
        <WaitingContent locale={locale} />
      )}
    </PageShell>
  )
}
