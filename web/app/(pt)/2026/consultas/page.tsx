import type { Metadata } from 'next'
import { PlaygroundPage, playgroundMetadata } from '@/views/playground-page'

export const metadata: Metadata = playgroundMetadata('pt')

export default function Page() {
  return <PlaygroundPage locale="pt" />
}
