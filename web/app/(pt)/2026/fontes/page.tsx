import type { Metadata } from 'next'
import { t } from '@/lib/i18n'
import { pageMetadata } from '@/views/metadata'
import { SourcesView } from '@/views/sources-view'

export const metadata: Metadata = pageMetadata('pt', '/2026/fontes/', t('pt', 'sources.title'))

export default function Page() {
  return <SourcesView locale="pt" />
}
