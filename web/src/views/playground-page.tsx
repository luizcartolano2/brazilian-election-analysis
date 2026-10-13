/** The playground page: its frame in the static HTML, and the playground once a browser runs it. */
import type { Metadata } from 'next'
import { brazilRoundLinks, PageShell } from '@/components/page-shell'
import { LABEL_KEYS, type Labels } from '@/components/playground/labels'
import { Playground } from '@/components/playground/playground'
import { getPlaygroundConfig, hasRound } from '@/lib/data'
import { ROUNDS, YEAR } from '@/lib/elections'
import { localePath, t, type Locale } from '@/lib/i18n'
import { PLAYGROUND_PATH, SOURCES_PATH } from '@/lib/paths'
import { pageMetadata } from '@/views/metadata'

export function playgroundMetadata(locale: Locale): Metadata {
  return pageMetadata(locale, PLAYGROUND_PATH, t(locale, 'playground.title'))
}

/** The browser fills each placeholder, so the messages go down as written. */
function playgroundLabels(locale: Locale): Labels {
  return Object.fromEntries(LABEL_KEYS.map((key) => [key, t(locale, key)])) as Labels
}

export function PlaygroundPage({ locale }: { locale: Locale }) {
  const sourcesHref = localePath(locale, SOURCES_PATH)
  return (
    <PageShell
      locale={locale}
      path={PLAYGROUND_PATH}
      crumbs={[
        { label: t(locale, 'area.brazil'), path: `/${YEAR}/` },
        { label: t(locale, 'playground.title') },
      ]}
      shows={ROUNDS.filter(hasRound)}
      roundLinks={brazilRoundLinks(null)}
      wide
    >
      <h1 className="text-4xl font-extrabold">{t(locale, 'playground.title')}</h1>
      <p className="text-muted mt-2 max-w-3xl">{t(locale, 'playground.intro')}</p>
      <noscript>
        <p className="mt-4 text-sm">
          {t(locale, 'playground.noScript')}{' '}
          <a href={sourcesHref} className="underline">
            {t(locale, 'nav.sources')}
          </a>
        </p>
      </noscript>
      <Playground
        locale={locale}
        config={getPlaygroundConfig()}
        labels={playgroundLabels(locale)}
        sourcesHref={sourcesHref}
      />
    </PageShell>
  )
}
