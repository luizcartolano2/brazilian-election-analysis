import type { Metadata } from 'next'
import { YEAR } from '@/lib/elections'
import { t } from '@/lib/i18n'
import { pageMetadata } from '@/views/metadata'
import { SourcesView } from '@/views/sources-view'

export const metadata: Metadata = pageMetadata('en', `/${YEAR}/fontes/`, t('en', 'sources.title'))

export default function Page() {
  return <SourcesView locale="en" />
}
