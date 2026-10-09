import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Drilldown } from '@/components/drilldown'
import { PageShell } from '@/components/page-shell'
import { getDrilldownConfig } from '@/lib/data'
import { YEAR } from '@/lib/elections'
import { t } from '@/lib/i18n'
import { pageMetadata } from '@/views/metadata'

export const metadata: Metadata = pageMetadata(
  'pt',
  `/${YEAR}/zona/`,
  t('pt', 'drilldown.zoneTitle'),
)

export default function Page() {
  return (
    <PageShell locale="pt" path={`/${YEAR}/zona/`} wide>
      <noscript>
        <p className="text-sm">{t('pt', 'drilldown.noScript')}</p>
      </noscript>
      <Suspense fallback={<p className="text-sm">{t('pt', 'drilldown.loading')}</p>}>
        <Drilldown locale="pt" level="zona" config={getDrilldownConfig()} />
      </Suspense>
    </PageShell>
  )
}
