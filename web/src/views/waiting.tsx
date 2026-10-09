/** What a round-2 address shows before a round-2 version is pinned: the date, and no result. */
import { AppLink } from '@/components/app-link'
import { PageShell, type Crumb, type RoundLinks } from '@/components/page-shell'
import { ROUND_DATES, YEAR } from '@/lib/elections'
import { formatDate, localePath, t, type Locale } from '@/lib/i18n'

export function WaitingContent({ locale }: { locale: Locale }) {
  return (
    <section data-testid="waiting">
      <h1 className="text-4xl font-extrabold sm:text-5xl">
        {t(locale, 'waiting.title', { date: formatDate(locale, ROUND_DATES.runoff) })}
      </h1>
      <p className="mt-3 text-lg">{t(locale, 'waiting.body')}</p>
      <p className="mt-6 text-sm font-semibold">
        <AppLink href={localePath(locale, `/${YEAR}/`)} className="underline">
          {t(locale, 'waiting.firstRoundLink')}
        </AppLink>
      </p>
    </section>
  )
}

export function WaitingView({
  locale,
  path,
  crumbs,
  roundLinks,
}: {
  locale: Locale
  path: string
  crumbs?: Crumb[]
  roundLinks?: RoundLinks
}) {
  return (
    <PageShell locale={locale} path={path} crumbs={crumbs} round={2} roundLinks={roundLinks} wide>
      <WaitingContent locale={locale} />
    </PageShell>
  )
}
