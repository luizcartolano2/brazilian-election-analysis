'use client'

import { useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { raceBySlug } from '@/lib/elections'

/**
 * A drill-down view's address in a round, with the same place. A race that the round does not
 * hold there is dropped, so the view opens on President, and an area that the round lacks leads
 * to its Brazil page. `races` is null for a round with no data yet, whose view keeps no query.
 */
export function drilldownRoundHref(
  href: string,
  brazil: string,
  params: URLSearchParams,
  races: Record<string, number[]> | null,
): string {
  if (races === null) return href
  const area = params.get('uf')
  if (area === null) return href
  const offered = races[area]
  if (offered === undefined) return brazil
  const kept = new URLSearchParams(params)
  const slug = kept.get('cargo')
  const code = slug === null ? undefined : raceBySlug(slug)?.code
  if (slug !== null && (code === undefined || !offered.includes(code))) kept.delete('cargo')
  const query = kept.toString()
  return query === '' ? href : `${href}?${query}`
}

export function DrilldownRoundLink({
  href,
  brazil,
  races,
  current,
  className,
  children,
}: {
  href: string
  brazil: string
  races: Record<string, number[]> | null
  current: boolean
  className: string
  children: ReactNode
}) {
  const params = new URLSearchParams(useSearchParams().toString())
  return (
    <a
      href={drilldownRoundHref(href, brazil, params, races)}
      aria-current={current ? 'page' : undefined}
      className={className}
    >
      {children}
    </a>
  )
}
