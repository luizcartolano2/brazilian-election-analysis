import { PageShell } from '@/components/page-shell'
import {
  getManifest,
  getRoundSource,
  getSourceInfo,
  type DataSourceInfo,
  type RoundSourceInfo,
} from '@/lib/data'
import { YEAR } from '@/lib/elections'
import { formatDateTime, formatInteger, t, type Locale, type MessageKey } from '@/lib/i18n'
import type { Manifest, ManifestSource } from '@/lib/manifest'
import { REPOSITORY } from '@/lib/site'

const IBGE_TERMS = 'https://biblioteca.ibge.gov.br/visualizacao/livros/liv102268.pdf'

// TSE's two hosts come with different terms, as DATA_LICENSE.md records.
const HOSTS: { pattern: RegExp; title: MessageKey; terms: MessageKey }[] = [
  {
    pattern: /^(https:\/\/cdn\.tse\.jus\.br\/|fixture:\/\/cdn\/)/,
    title: 'sources.portalTitle',
    terms: 'sources.portalTerms',
  },
  {
    pattern: /^(https:\/\/resultados\.tse\.jus\.br\/|fixture:\/\/results\/)/,
    title: 'sources.resultsTitle',
    terms: 'sources.resultsTerms',
  },
]

function fileName(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1)
}

function SourceList({ locale, sources }: { locale: Locale; sources: ManifestSource[] }) {
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {sources.map((entry) => (
        <li key={entry.key} className="break-all">
          {entry.url.startsWith('https://') ? (
            <a href={entry.url} className="underline">
              {fileName(entry.url)}
            </a>
          ) : (
            <span>{fileName(entry.url)}</span>
          )}{' '}
          <span className="text-muted text-xs">
            {formatInteger(locale, entry.size)} B · {formatDateTime(locale, entry.downloaded_at)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** The sources page's content, apart from the data it reads, so tests can render it. */
export function SourcesContent({
  locale,
  manifest,
  source,
  version,
}: {
  locale: Locale
  manifest: Manifest
  source: DataSourceInfo
  version: RoundSourceInfo
}) {
  const sources = [...manifest.fontes].sort((a, b) => a.key.localeCompare(b.key))
  const unknownHost = sources.filter((entry) => !HOSTS.some((host) => host.pattern.test(entry.url)))
  if (unknownHost.length > 0) {
    throw new Error(`no terms recorded for ${unknownHost.map((entry) => entry.url).join(', ')}`)
  }
  return (
    <>
      <h1 className="text-4xl font-extrabold">{t(locale, 'sources.title')}</h1>
      <p className="mt-2 text-sm">{t(locale, 'sources.intro')}</p>
      <p className="mt-2 text-sm">{t(locale, 'sources.checks')}</p>

      <h2 className="mt-6 text-2xl font-extrabold">{t(locale, 'sources.versionTitle')}</h2>
      {source.mode === 'published' && version.version !== null ? (
        <dl className="mt-2 text-sm">
          <dt className="text-muted text-xs">{t(locale, 'sources.version')}</dt>
          <dd className="font-mono break-all" data-testid="data-version">
            {version.version}
          </dd>
          <dt className="text-muted mt-2 text-xs">{t(locale, 'sources.builtAt')}</dt>
          <dd>{formatDateTime(locale, manifest.gerado_em)}</dd>
          <dt className="text-muted mt-2 text-xs">{t(locale, 'sources.commit')}</dt>
          <dd>
            <a href={`${REPOSITORY}/commit/${manifest.commit}`} className="font-mono underline">
              {manifest.commit.slice(0, 7)}
            </a>
          </dd>
          <dt className="text-muted mt-2 text-xs">{t(locale, 'sources.manifest')}</dt>
          <dd>
            <a href={`${version.dataBase}/manifest.json`} className="underline">
              manifest.json
            </a>
          </dd>
        </dl>
      ) : (
        <p className="mt-2 text-sm" data-testid="data-version">
          {t(locale, 'sources.fixtures')}
        </p>
      )}

      <h2 className="mt-6 text-2xl font-extrabold">{t(locale, 'sources.licenseTitle')}</h2>
      <p className="mt-2 text-sm">{t(locale, 'sources.licenseDerived')}</p>
      <blockquote className="border-ink/20 mt-2 border-l-2 pl-3 text-sm">
        {manifest.credito[locale]}
      </blockquote>

      <h2 className="mt-6 text-2xl font-extrabold">{t(locale, 'sources.boundariesTitle')}</h2>
      <p className="mt-2 text-sm">{t(locale, 'sources.boundariesIntro')}</p>
      <p className="mt-2 text-sm">
        {t(locale, 'sources.boundariesTerms')}{' '}
        <a href={IBGE_TERMS} className="underline">
          {t(locale, 'sources.boundariesNote')}
        </a>
        .
      </p>
      <blockquote className="border-ink/20 mt-2 border-l-2 pl-3 text-sm">
        {t(locale, 'sources.boundariesCredit')}
      </blockquote>
      {source.mode === 'published' ? (
        <dl className="mt-2 text-sm">
          <dt className="text-muted text-xs">{t(locale, 'sources.boundariesBuild')}</dt>
          <dd className="font-mono break-all" data-testid="boundary-build">
            {source.geoBase.slice(source.geoBase.lastIndexOf('/') + 1)}
          </dd>
          <dt className="text-muted mt-2 text-xs">{t(locale, 'sources.manifest')}</dt>
          <dd>
            <a href={`${source.geoBase}/manifest.json`} className="underline">
              manifest.json
            </a>
          </dd>
        </dl>
      ) : (
        <p className="mt-2 text-sm" data-testid="boundary-build">
          {t(locale, 'sources.boundariesFixtures')}
        </p>
      )}

      <h2 className="mt-6 text-2xl font-extrabold">{t(locale, 'sources.namesTitle')}</h2>
      <p className="mt-1 text-sm" data-testid="names-note">
        {t(locale, 'sources.namesNote')}
      </p>

      <h2 className="mt-6 text-2xl font-extrabold">{t(locale, 'sources.filesTitle')}</h2>
      <p className="text-muted mt-1 text-sm">
        {t(locale, 'sources.filesNote', { count: formatInteger(locale, sources.length) })}
      </p>
      {HOSTS.map((host) => {
        const fromHost = sources.filter((entry) => host.pattern.test(entry.url))
        if (fromHost.length === 0) return null
        return (
          <section key={host.title} className="mt-4">
            <h3 className="text-base font-semibold">{t(locale, host.title)}</h3>
            <p className="text-muted mt-1 text-sm">{t(locale, host.terms)}</p>
            <SourceList locale={locale} sources={fromHost} />
          </section>
        )
      })}
    </>
  )
}

/** Where every number comes from: TSE's files, their terms, and the pinned data version. */
export function SourcesView({ locale }: { locale: Locale }) {
  return (
    <PageShell
      locale={locale}
      path={`/${YEAR}/fontes/`}
      crumbs={[
        { label: t(locale, 'area.brazil'), path: `/${YEAR}/` },
        { label: t(locale, 'nav.sources') },
      ]}
      wide
    >
      {/* Prose keeps a readable line length inside the wide column. */}
      <div className="max-w-3xl">
        <SourcesContent
          locale={locale}
          manifest={getManifest()}
          source={getSourceInfo()}
          version={getRoundSource()}
        />
      </div>
    </PageShell>
  )
}
