import type { Metadata } from 'next'
import './globals.css'
import { localePath, t, type Locale } from '@/lib/i18n'
import { REPOSITORY } from '@/lib/site'

export const metadata: Metadata = {
  title: `404 · ${t('pt', 'notFound.title')} · ${t('en', 'notFound.title')}`,
}

const LOCALES: Locale[] = ['pt', 'en']

/** One page for any unknown address, in both languages, because no layout applies to it. */
export default function GlobalNotFound() {
  return (
    <html lang="pt-BR">
      <body>
        <div className="mx-auto max-w-3xl px-4">
          <main className="py-10">
            {LOCALES.map((locale) => (
              <section key={locale} lang={locale === 'pt' ? 'pt-BR' : 'en'} className="mb-8">
                <h1 className="text-2xl font-semibold">{t(locale, 'notFound.title')}</h1>
                <p className="mt-2">{t(locale, 'notFound.body')}</p>
                <p className="mt-2">
                  <a href={localePath(locale, '/2026/')} className="underline">
                    {t(locale, 'notFound.home')}
                  </a>
                </p>
              </section>
            ))}
          </main>
          <footer className="border-t border-slate-200 py-4 text-xs text-slate-600">
            {LOCALES.map((locale) => (
              <p key={locale} lang={locale === 'pt' ? 'pt-BR' : 'en'} className="mb-1">
                {t(locale, 'footer.credit')}
              </p>
            ))}
            <p className="mt-2">
              {t('pt', 'footer.author')} ·{' '}
              <a href={REPOSITORY} className="underline">
                {t('pt', 'footer.repository')}
              </a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  )
}
