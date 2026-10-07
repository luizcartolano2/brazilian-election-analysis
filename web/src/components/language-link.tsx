'use client'

import { useSearchParams } from 'next/navigation'

/** The other language's address of this page, with the same place and race. */
export function LanguageLink({
  href,
  language,
  label,
}: {
  href: string
  language: 'pt-BR' | 'en'
  label: string
}) {
  const search = useSearchParams().toString()
  return (
    <a href={search === '' ? href : `${href}?${search}`} hrefLang={language} lang={language}>
      {label}
    </a>
  )
}
