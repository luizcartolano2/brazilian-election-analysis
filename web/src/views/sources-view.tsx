import { PageShell } from '@/components/page-shell'
import { VERSION_URL } from '@/data-version'
import { getManifest, getSourceInfo } from '@/lib/data'
import { YEAR } from '@/lib/elections'
import { formatDateTime, formatInteger, t, type Locale } from '@/lib/i18n'

const REPOSITORY = 'https://github.com/luizcartolano2/brazilian-election-analysis'

function fileName(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1)
}

/** Where every number comes from: TSE's files, the license, and the pinned data version. */
export function SourcesView({ locale }: { locale: Locale }) {
  const manifest = getManifest()
  const source = getSourceInfo()
  const sources = [...manifest.fontes].sort((a, b) => a.key.localeCompare(b.key))
  return (
    <PageShell
      locale={locale}
      path={`/${YEAR}/fontes/`}
      crumbs={[
        { label: t(locale, 'area.brazil'), path: `/${YEAR}/` },
        { label: t(locale, 'nav.sources') },
      ]}
    >
      <h1 className="text-2xl font-semibold">{t(locale, 'sources.title')}</h1>
      <p className="mt-2 text-sm">{t(locale, 'sources.intro')}</p>
      <p className="mt-2 text-sm">{t(locale, 'sources.checks')}</p>

      <h2 className="mt-6 text-xl font-semibold">{t(locale, 'sources.versionTitle')}</h2>
      {source.mode === 'published' && source.version !== null ? (
        <dl className="mt-2 text-sm">
          <dt className="text-xs text-slate-600">{t(locale, 'sources.version')}</dt>
          <dd className="font-mono break-all" data-testid="data-version">
            {source.version}
          </dd>
          <dt className="mt-2 text-xs text-slate-600">{t(locale, 'sources.builtAt')}</dt>
          <dd>{formatDateTime(locale, manifest.gerado_em)}</dd>
          <dt className="mt-2 text-xs text-slate-600">{t(locale, 'sources.commit')}</dt>
          <dd>
            <a href={`${REPOSITORY}/commit/${manifest.commit}`} className="font-mono underline">
              {manifest.commit.slice(0, 7)}
            </a>
          </dd>
          <dt className="mt-2 text-xs text-slate-600">{t(locale, 'sources.manifest')}</dt>
          <dd>
            <a href={`${VERSION_URL}/manifest.json`} className="underline">
              manifest.json
            </a>
          </dd>
        </dl>
      ) : (
        <p className="mt-2 text-sm" data-testid="data-version">
          {t(locale, 'sources.fixtures')}
        </p>
      )}

      <h2 className="mt-6 text-xl font-semibold">{t(locale, 'sources.licenseTitle')}</h2>
      <p className="mt-2 text-sm">{t(locale, 'sources.licenseTse')}</p>
      <p className="mt-2 text-sm">{t(locale, 'sources.licenseDerived')}</p>
      <blockquote className="mt-2 border-l-2 border-slate-300 pl-3 text-sm">
        {manifest.credito[locale]}
      </blockquote>

      <h2 className="mt-6 text-xl font-semibold">{t(locale, 'sources.filesTitle')}</h2>
      <p className="mt-1 text-sm text-slate-700">
        {t(locale, 'sources.filesNote', { count: formatInteger(locale, sources.length) })}
      </p>
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
            <span className="text-xs text-slate-600">
              {formatInteger(locale, entry.size)} B · {formatDateTime(locale, entry.downloaded_at)}
            </span>
          </li>
        ))}
      </ul>
    </PageShell>
  )
}
