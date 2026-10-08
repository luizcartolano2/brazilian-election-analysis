import { Suspense, type ReactNode } from 'react'
import { AppLink as Link } from '@/components/app-link'
import { LanguageLink } from '@/components/language-link'
import { outcomeLabels } from '@/components/results'
import { SiteSearch, type SearchLabels } from '@/components/site-search'
import { getSourceInfo } from '@/lib/data'
import { YEAR } from '@/lib/elections'
import { localePath, t, type Locale } from '@/lib/i18n'
import { MAX_RESULTS } from '@/lib/search'
import { REPOSITORY } from '@/lib/site'

export interface Crumb {
  label: string
  /** The Portuguese address, or nothing for the current page. */
  path?: string
}

/**
 * Header, breadcrumbs and footer around a page. `path` is the page's Portuguese address, so
 * the language switch lands on the same page in the other language.
 */
export function PageShell({
  locale,
  path,
  crumbs = [],
  children,
}: {
  locale: Locale
  path: string
  crumbs?: Crumb[]
  children: ReactNode
}) {
  const other: Locale = locale === 'pt' ? 'en' : 'pt'
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 py-3">
        <Link href={localePath(locale, `/${YEAR}/`)} className="font-semibold">
          {t(locale, 'site.name')}
        </Link>
        <nav className="flex gap-4 text-sm">
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
        {/* Holds the box's height before the script runs, so the page does not move. */}
        <div className="min-h-8 basis-full noscript:hidden">
          <SiteSearch
            locale={locale}
            base={getSourceInfo().searchBase}
            labels={searchLabels(locale)}
          />
        </div>
      </header>
      {getSourceInfo().mode === 'fixtures' && (
        <p
          data-testid="fixtures-banner"
          className="mt-3 rounded bg-amber-100 p-2 text-sm text-amber-900"
        >
          {t(locale, 'site.fixturesBanner')}
        </p>
      )}
      {crumbs.length > 0 && (
        <nav aria-label={t(locale, 'nav.breadcrumbs')} className="pt-3 text-sm text-slate-600">
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
      <main className="flex-1 py-4">{children}</main>
      <SiteFooter locale={locale} />
    </div>
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
    <footer className="border-t border-slate-200 py-4 text-xs text-slate-600">
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
    </footer>
  )
}
