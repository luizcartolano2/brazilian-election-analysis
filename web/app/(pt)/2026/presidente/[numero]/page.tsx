import type { Metadata } from 'next'
import {
  candidatePagePath,
  candidateTitle,
  CandidateView,
  presidentParams,
  type PresidentParams,
} from '@/views/candidate-views'
import { pageMetadata } from '@/views/metadata'

export const dynamicParams = false
export const generateStaticParams = presidentParams

export async function generateMetadata({ params }: { params: PresidentParams }): Promise<Metadata> {
  const { numero } = await params
  return pageMetadata(
    'pt',
    candidatePagePath('br', 'presidente', numero),
    candidateTitle('pt', 'br', 'presidente', numero),
  )
}

export default async function Page({ params }: { params: PresidentParams }) {
  const { numero } = await params
  return <CandidateView locale="pt" area="br" slug="presidente" numero={numero} />
}
