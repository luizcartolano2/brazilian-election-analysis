import type { Metadata } from 'next'
import { DrilldownPage, drilldownMetadata } from '@/views/drilldown-page'

export const metadata: Metadata = drilldownMetadata('en', 'municipio', 1)

export default function Page() {
  return <DrilldownPage locale="en" level="municipio" round={1} />
}
