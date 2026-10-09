import type { Metadata } from 'next'
import { DrilldownPage, drilldownMetadata } from '@/views/drilldown-page'

export const metadata: Metadata = drilldownMetadata('pt', 'secao', 2)

export default function Page() {
  return <DrilldownPage locale="pt" level="secao" round={2} />
}
