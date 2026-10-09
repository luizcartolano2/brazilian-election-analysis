import type { Metadata } from 'next'
import { DrilldownPage, drilldownMetadata } from '@/views/drilldown-page'

export const metadata: Metadata = drilldownMetadata('en', 'zona', 1)

export default function Page() {
  return <DrilldownPage locale="en" level="zona" round={1} />
}
