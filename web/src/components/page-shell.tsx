import Link from 'next/link'
import type { ReactNode } from 'react'
import { YEAR } from '@/lib/elections'
import { localePath, t, type Locale } from '@/lib/i18n'

const REPOSITORY = 'https://github.com/luizcartolano2/brazilian-election-analysis'

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
          <a href={localePath(other, path)} hrefLang={other === 'pt' ? 'pt-BR' : 'en'} lang={other}>
            {t(locale, 'nav.otherLanguage')}
          </a>
        </nav>
      </header>
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
