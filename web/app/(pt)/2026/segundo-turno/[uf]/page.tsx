import type { Metadata } from 'next'
import { YEAR } from '@/lib/elections'
import { roundPath } from '@/lib/paths'
import { AreaView, pageTitle } from '@/views/area-views'
import { pageMetadata } from '@/views/metadata'
import { runoffAreaParams, type AreaParams } from '@/views/params'

export const dynamicParams = false
export const generateStaticParams = runoffAreaParams

export async function generateMetadata({ params }: { params: AreaParams }): Promise<Metadata> {
  const { uf } = await params
  return pageMetadata('pt', roundPath(2, `/${YEAR}/${uf}/`), pageTitle('pt', uf, undefined, 2))
}

export default async function Page({ params }: { params: AreaParams }) {
  const { uf } = await params
  return <AreaView locale="pt" code={uf} round={2} />
}
