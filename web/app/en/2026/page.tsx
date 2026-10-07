import type { Metadata } from 'next'
import { YEAR } from '@/lib/elections'
import { t } from '@/lib/i18n'
import { BrazilView } from '@/views/area-views'
import { pageMetadata } from '@/views/metadata'

export const metadata: Metadata = pageMetadata('en', `/${YEAR}/`, t('en', 'brazil.title'))

export default function Page() {
  return <BrazilView locale="en" />
}
