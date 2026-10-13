import type { Metadata } from 'next'
import { t } from '@/lib/i18n'
import { SOURCES_PATH } from '@/lib/paths'
import { pageMetadata } from '@/views/metadata'
import { SourcesView } from '@/views/sources-view'

export const metadata: Metadata = pageMetadata('en', SOURCES_PATH, t('en', 'sources.title'))

export default function Page() {
  return <SourcesView locale="en" />
}
