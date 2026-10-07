import type { Metadata } from 'next'
import { pageTitle, RaceView } from '@/views/area-views'
import { pageMetadata } from '@/views/metadata'
import { raceParams, type RaceParams } from '@/views/params'

export const dynamicParams = false
export const generateStaticParams = raceParams

export async function generateMetadata({ params }: { params: RaceParams }): Promise<Metadata> {
  const { uf, cargo } = await params
  return pageMetadata('pt', `/2026/${uf}/${cargo}/`, pageTitle('pt', uf, cargo))
}

export default async function Page({ params }: { params: RaceParams }) {
  const { uf, cargo } = await params
  return <RaceView locale="pt" code={uf} slug={cargo} />
}
