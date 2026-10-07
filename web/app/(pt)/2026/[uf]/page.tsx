import type { Metadata } from 'next'
import { AreaView, pageTitle } from '@/views/area-views'
import { pageMetadata } from '@/views/metadata'
import { areaParams, type AreaParams } from '@/views/params'

export const dynamicParams = false
export const generateStaticParams = areaParams

export async function generateMetadata({ params }: { params: AreaParams }): Promise<Metadata> {
  const { uf } = await params
  return pageMetadata('pt', `/2026/${uf}/`, pageTitle('pt', uf))
}

export default async function Page({ params }: { params: AreaParams }) {
  const { uf } = await params
  return <AreaView locale="pt" code={uf} />
}
