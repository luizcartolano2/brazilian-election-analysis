import type { Metadata } from 'next'
import { YEAR } from '@/lib/elections'
import { roundPath } from '@/lib/paths'
import { pageTitle, RaceView } from '@/views/area-views'
import { pageMetadata } from '@/views/metadata'
import { runoffRaceParams, type RaceParams } from '@/views/params'

export const dynamicParams = false
export const generateStaticParams = runoffRaceParams

export async function generateMetadata({ params }: { params: RaceParams }): Promise<Metadata> {
  const { uf, cargo } = await params
  return pageMetadata(
    'en',
    roundPath(2, `/${YEAR}/${uf}/${cargo}/`),
    pageTitle('en', uf, cargo, 2),
    2,
  )
}

export default async function Page({ params }: { params: RaceParams }) {
  const { uf, cargo } = await params
  return <RaceView locale="en" code={uf} slug={cargo} round={2} />
}
