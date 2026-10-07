import type { Metadata } from 'next'
import { t } from '@/lib/i18n'
import { BrazilView } from '@/views/area-views'
import { pageMetadata } from '@/views/metadata'

export const metadata: Metadata = pageMetadata('en', '/2026/', t('en', 'brazil.title'))

export default function Page() {
  return <BrazilView locale="en" />
}
