import { Suspense, type ReactNode } from 'react'
import { AppLink as Link } from '@/components/app-link'
import { LanguageLink } from '@/components/language-link'
import { outcomeLabels } from '@/components/results'
import { DrilldownRoundLink } from '@/components/round-link'
import { SiteSearch, type SearchLabels } from '@/components/site-search'
import { getRoundSource, getSourceInfo, hasRound } from '@/lib/data'
import { roundDate, ROUNDS, YEAR, type Round } from '@/lib/elections'
import { formatDayMonth, localePath, t, type Locale } from '@/lib/i18n'
import { roundPath } from '@/lib/paths'
import { MAX_RESULTS } from '@/lib/search'
import { REPOSITORY } from '@/lib/site'

export interface Crumb {
  label: string
  /** The Portuguese address, or nothing for the current page. */
  path?: string
}

export interface RoundLinks {
  /** The round the page shows, or null on a page that shows both rounds or neither. */
  current: Round | null
  /** Each round's Portuguese address, which can end in a fragment. */
  hrefs: Record<Round, string>
  /** On a drill-down view, each round's races by area, so the link keeps the place. */
  drilldownRaces?: Record<Round, Record<string, number[]> | null>
}

/** Each round's Brazil page, with the page's own round marked. */
export function brazilRoundLinks(current: Round | null): RoundLinks {
  return { current, hrefs: { 1: `/${YEAR}/`, 2: roundPath(2, `/${YEAR}/`) } }
}

/** The header's choice of round: two links, each with its election day. */
function RoundSwitch({ locale, links }: { locale: Locale; links: RoundLinks }) {
  return (
    <nav
      aria-label={t(locale, 'nav.rounds')}
      className="bg-surface flex flex-wrap rounded-full p-1 text-xs font-semibold"
      data-testid="round-switch"
    >
      {ROUNDS.map((round) => {
        const current = links.current === round
        const className = `rounded-full px-3 py-1 ${current ? 'bg-ink text-white' : 'underline-offset-2 hover:underline'}`
        const href = localePath(locale, links.hrefs[round])
        const label = (
          <>
            {t(locale, round === 1 ? 'site.firstRound' : 'site.secondRound')} ·{' '}
            <time dateTime={roundDate(round)}>{formatDayMonth(locale, roundDate(round))}</time>
          </>
        )
        const races = links.drilldownRaces?.[round]
        if (races !== undefined && !current) {
          return (
            <Suspense
              key={round}
              fallback={
                <a href={href} className={className}>
                  {label}
                </a>
              }
            >
              <DrilldownRoundLink href={href} races={races} className={className}>
                {label}
              </DrilldownRoundLink>
            </Suspense>
          )
        }
        return (
          <Link
            key={round}
            href={href}
            aria-current={current ? 'page' : undefined}
            className={className}
            data-round={round}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

/** A test build's notice. A synthetic round says that its numbers copy round 1. */
export function FixturesNotice({ locale, synthetic }: { locale: Locale; synthetic: boolean }) {
  return (
    <p
      data-testid="fixtures-banner"
      className="mt-3 rounded bg-amber-100 p-2 text-sm text-amber-900"
    >
      {t(locale, synthetic ? 'site.syntheticBanner' : 'site.fixturesBanner')}
    </p>
  )
}

/**
 * Header, breadcrumbs and footer around a page. `path` is the page's Portuguese address, so
 * the language switch lands on the same page in the other language.
 */
export function PageShell({
  locale,
  path,
  crumbs = [],
  wide = false,
  round = 1,
  roundLinks = brazilRoundLinks(round),
  children,
}: {
  locale: Locale
  path: string
  crumbs?: Crumb[]
  /** The 1,200-pixel column of a page that has its new layout. */
  wide?: boolean
  /** The round whose data the page shows. */
  round?: Round
  /** Where the header's choice of round leads. By default, each round's Brazil page. */
  roundLinks?: RoundLinks
  children: ReactNode
}) {
  const other: Locale = locale === 'pt' ? 'en' : 'pt'
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-line border-b bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
          <Link
            href={localePath(locale, `/${YEAR}/`)}
            className="font-display flex items-center gap-2.5 text-xl font-extrabold"
          >
            <BallotMark />
            {t(locale, 'site.name')}
          </Link>
          <RoundSwitch locale={locale} links={roundLinks} />
          {/* Holds the box's height before the script runs, so the page does not move. */}
          <div className="min-h-11 min-w-0 flex-[999_1_16rem] noscript:hidden">
            <SiteSearch
              locale={locale}
              base={getSourceInfo().searchBase}
              labels={searchLabels(locale)}
            />
          </div>
          <nav className="flex gap-4 text-sm font-semibold">
            <Link href={`${localePath(locale, roundPath(round, `/${YEAR}/`))}#estados`}>
              {t(locale, 'nav.states')}
            </Link>
            <Link href={localePath(locale, `/${YEAR}/fontes/`)}>{t(locale, 'nav.sources')}</Link>
            <Suspense
              fallback={
                <a
                  href={localePath(other, path)}
                  hrefLang={other === 'pt' ? 'pt-BR' : 'en'}
                  lang={other === 'pt' ? 'pt-BR' : 'en'}
                >
                  {t(locale, 'nav.otherLanguage')}
                </a>
              }
            >
              <LanguageLink
                href={localePath(other, path)}
                language={other === 'pt' ? 'pt-BR' : 'en'}
                label={t(locale, 'nav.otherLanguage')}
              />
            </Suspense>
          </nav>
        </div>
      </header>
      <div
        className={`mx-auto w-full flex-1 px-4 ${wide ? 'max-w-[1200px] sm:px-6' : 'max-w-3xl'}`}
      >
        {getSourceInfo().mode === 'fixtures' && (
          <FixturesNotice
            locale={locale}
            synthetic={hasRound(round) && getRoundSource(round).synthetic}
          />
        )}
        {crumbs.length > 0 && (
          <nav aria-label={t(locale, 'nav.breadcrumbs')} className="text-muted pt-4 text-sm">
            <ol className="flex flex-wrap gap-1">
              {crumbs.map((crumb, index) => (
                <li key={crumb.label} className="flex gap-1">
                  {index > 0 && <span aria-hidden="true">›</span>}
                  {crumb.path === undefined ? (
                    <span aria-current="page">{crumb.label}</span>
                  ) : (
                    <Link href={localePath(locale, crumb.path)} className="underline">
                      {crumb.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <main className="py-5">{children}</main>
      </div>
      <SiteFooter locale={locale} />
    </div>
  )
}

/** A ballot box, the site's mark. */
function BallotMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="10" width="18" height="11" rx="2" />
      <path d="M8 10V5h8v5M9 7.5h6M3 15h18" />
    </svg>
  )
}

function searchLabels(locale: Locale): SearchLabels {
  return {
    label: t(locale, 'siteSearch.label'),
    placeholder: t(locale, 'siteSearch.placeholder'),
    loading: t(locale, 'siteSearch.loading'),
    failed: t(locale, 'siteSearch.failed'),
    none: t(locale, 'siteSearch.none'),
    one: t(locale, 'siteSearch.one'),
    many: t(locale, 'siteSearch.many'),
    more: t(locale, 'siteSearch.more', { count: String(MAX_RESULTS) }),
    brazil: t(locale, 'area.brazil'),
    outcomes: outcomeLabels(locale),
  }
}

function SiteFooter({ locale }: { locale: Locale }) {
  return (
    <footer className="border-line bg-surface border-t">
      <div className="text-muted mx-auto max-w-[1200px] px-4 py-6 text-xs sm:px-6">
        <p>{t(locale, 'footer.credit')}</p>
        <p className="mt-2">
          {t(locale, 'footer.author')} ·{' '}
          <a href={REPOSITORY} className="underline">
            {t(locale, 'footer.repository')}
          </a>{' '}
          ·{' '}
          <Link href={localePath(locale, `/${YEAR}/fontes/`)} className="underline">
            {t(locale, 'footer.sources')}
          </Link>
        </p>
      </div>
    </footer>
  )
}
