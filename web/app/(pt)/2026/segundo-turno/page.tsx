import type { Metadata } from 'next'
import { YEAR } from '@/lib/elections'
import { roundPath } from '@/lib/paths'
import { BrazilView, pageTitle } from '@/views/area-views'
import { pageMetadata } from '@/views/metadata'

export const metadata: Metadata = pageMetadata(
  'pt',
  roundPath(2, `/${YEAR}/`),
  pageTitle('pt', undefined, undefined, 2),
  2,
)

export default function Page() {
  return <BrazilView locale="pt" round={2} />
}
