import type { Metadata } from 'next'
import { YEAR } from '@/lib/elections'
import { t } from '@/lib/i18n'
import { BrazilView } from '@/views/area-views'
import { pageMetadata } from '@/views/metadata'

export const metadata: Metadata = pageMetadata('pt', `/${YEAR}/`, t('pt', 'brazil.title'))

export default function Page() {
  return <BrazilView locale="pt" />
}
