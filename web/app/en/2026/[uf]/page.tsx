import type { Metadata } from 'next'
import { YEAR } from '@/lib/elections'
import { AreaView, pageTitle } from '@/views/area-views'
import { pageMetadata } from '@/views/metadata'
import { areaParams, type AreaParams } from '@/views/params'

export const dynamicParams = false
export const generateStaticParams = areaParams

export async function generateMetadata({ params }: { params: AreaParams }): Promise<Metadata> {
  const { uf } = await params
  return pageMetadata('en', `/${YEAR}/${uf}/`, pageTitle('en', uf))
}

export default async function Page({ params }: { params: AreaParams }) {
  const { uf } = await params
  return <AreaView locale="en" code={uf} />
}
