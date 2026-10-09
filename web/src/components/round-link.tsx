'use client'

import { useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { raceBySlug } from '@/lib/elections'

/**
 * A drill-down view's address in another round, with the same place. A race that the other
 * round does not hold there is dropped, so the view opens on President. `races` is null for a
 * round with no data yet, whose page has no query to keep.
 */
export function drilldownRoundHref(
  href: string,
  params: URLSearchParams,
  races: Record<string, number[]> | null,
): string {
  const area = params.get('uf')
  const offered = area === null || races === null ? undefined : races[area]
  if (offered === undefined) return href
  const kept = new URLSearchParams(params)
  const slug = kept.get('cargo')
  const code = slug === null ? undefined : raceBySlug(slug)?.code
  if (slug !== null && (code === undefined || !offered.includes(code))) kept.delete('cargo')
  const query = kept.toString()
  return query === '' ? href : `${href}?${query}`
}

export function DrilldownRoundLink({
  href,
  races,
  className,
  children,
}: {
  href: string
  races: Record<string, number[]> | null
  className: string
  children: ReactNode
}) {
  const params = new URLSearchParams(useSearchParams().toString())
  return (
    <a href={drilldownRoundHref(href, params, races)} className={className}>
      {children}
    </a>
  )
}
