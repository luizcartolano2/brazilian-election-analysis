import Link from 'next/link'
import type { ComponentProps } from 'react'

/**
 * A link that never prefetches. Pages here have no client state to keep, and prefetching
 * would download every linked page's data as its link scrolls into view.
 */
export function AppLink(props: Omit<ComponentProps<typeof Link>, 'prefetch'>) {
  return <Link {...props} prefetch={false} />
}
