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
  `/${YEAR}/secao/`,
  t('pt', 'drilldown.stationTitle'),
)

export default function Page() {
  return (
    <PageShell locale="pt" path={`/${YEAR}/secao/`}>
      <Suspense fallback={<p className="text-sm">{t('pt', 'drilldown.loading')}</p>}>
        <Drilldown locale="pt" level="secao" config={getDrilldownConfig()} />
      </Suspense>
    </PageShell>
  )
}
