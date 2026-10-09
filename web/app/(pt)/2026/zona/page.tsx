import type { Metadata } from 'next'
import { DrilldownPage, drilldownMetadata } from '@/views/drilldown-page'

export const metadata: Metadata = drilldownMetadata('pt', 'zona', 1)

export default function Page() {
  return <DrilldownPage locale="pt" level="zona" round={1} />
}
