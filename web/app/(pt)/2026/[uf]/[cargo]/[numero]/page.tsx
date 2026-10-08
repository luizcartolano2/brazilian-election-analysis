import type { Metadata } from 'next'
import {
  candidatePagePath,
  candidateParams,
  candidateTitle,
  CandidateView,
  type CandidateParams,
} from '@/views/candidate-views'
import { pageMetadata } from '@/views/metadata'

export const dynamicParams = false
export const generateStaticParams = candidateParams

export async function generateMetadata({ params }: { params: CandidateParams }): Promise<Metadata> {
  const { uf, cargo, numero } = await params
  return pageMetadata(
    'pt',
    candidatePagePath(uf, cargo, numero),
    candidateTitle('pt', uf, cargo, numero),
  )
}

export default async function Page({ params }: { params: CandidateParams }) {
  const { uf, cargo, numero } = await params
  return <CandidateView locale="pt" area={uf} slug={cargo} numero={numero} />
}
