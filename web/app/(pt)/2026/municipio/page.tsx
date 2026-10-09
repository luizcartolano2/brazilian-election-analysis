import type { Metadata } from 'next'
import { DrilldownPage, drilldownMetadata } from '@/views/drilldown-page'

export const metadata: Metadata = drilldownMetadata('pt', 'municipio', 1)

export default function Page() {
  return <DrilldownPage locale="pt" level="municipio" round={1} />
}
