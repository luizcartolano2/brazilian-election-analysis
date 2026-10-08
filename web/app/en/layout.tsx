import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '../globals.css'
import { FONT_VARIABLES } from '../fonts'
import { layoutMetadata } from '@/views/metadata'

export const metadata: Metadata = layoutMetadata('en')

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={FONT_VARIABLES}>
      <body>{children}</body>
    </html>
  )
}
