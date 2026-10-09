import type { Metadata } from 'next'
import { YEAR } from '@/lib/elections'
import { roundPath } from '@/lib/paths'
import { BrazilView, pageTitle } from '@/views/area-views'
import { pageMetadata } from '@/views/metadata'

export const metadata: Metadata = pageMetadata(
  'en',
  roundPath(2, `/${YEAR}/`),
  pageTitle('en', undefined, undefined, 2),
)

export default function Page() {
  return <BrazilView locale="en" round={2} />
}
