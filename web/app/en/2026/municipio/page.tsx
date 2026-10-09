import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Drilldown } from '@/components/drilldown'
import { PageShell } from '@/components/page-shell'
import { getDrilldownConfig } from '@/lib/data'
import { YEAR } from '@/lib/elections'
import { t } from '@/lib/i18n'
import { pageMetadata } from '@/views/metadata'

export const metadata: Metadata = pageMetadata(
  'en',
  `/${YEAR}/municipio/`,
  t('en', 'drilldown.municipalityTitle'),
)

export default function Page() {
  return (
    <PageShell locale="en" path={`/${YEAR}/municipio/`} wide>
      <noscript>
        <p className="text-sm">{t('en', 'drilldown.noScript')}</p>
      </noscript>
      <Suspense fallback={<p className="text-sm">{t('en', 'drilldown.loading')}</p>}>
        <Drilldown locale="en" level="municipio" config={getDrilldownConfig()} />
      </Suspense>
    </PageShell>
  )
}
