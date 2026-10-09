import type { Metadata } from 'next'
import type { Round } from '@/lib/elections'
import { localePath, t, type Locale } from '@/lib/i18n'
import { SITE_URL } from '@/lib/site'

export function layoutMetadata(locale: Locale): Metadata {
  const name = t(locale, 'site.name')
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: name, template: `%s · ${name}` },
    description: t(locale, 'meta.description'),
  }
}

/** `path` is the Portuguese address, so both languages point at each other. */
export function pageMetadata(
  locale: Locale,
  path: string,
  title: string,
  round: Round = 1,
): Metadata {
  return {
    title,
    ...(round === 2 ? { description: t(locale, 'meta.descriptionRunoff') } : {}),
    alternates: {
      canonical: localePath(locale, path),
      languages: { 'pt-BR': localePath('pt', path), en: localePath('en', path) },
    },
  }
}
