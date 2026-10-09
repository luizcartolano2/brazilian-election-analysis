import type { Metadata } from 'next'
import { DrilldownPage, drilldownMetadata } from '@/views/drilldown-page'

export const metadata: Metadata = drilldownMetadata('en', 'secao', 2)

export default function Page() {
  return <DrilldownPage locale="en" level="secao" round={2} />
}
