'use client'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

export interface RacePanel {
  /** The race's slug, which is also the panel's id and the address's fragment. */
  slug: string
  label: string
  content: ReactNode
}

// Selecting a tab rewrites the fragment with replaceState, which fires no hashchange.
const SELECT_EVENT = 'racetabselect'

function noSubscription() {
  return () => {}
}

function subscribeToHash(callback: () => void) {
  window.addEventListener('hashchange', callback)
  window.addEventListener(SELECT_EVENT, callback)
  return () => {
    window.removeEventListener('hashchange', callback)
    window.removeEventListener(SELECT_EVENT, callback)
  }
}

function select(slug: string) {
  history.replaceState(null, '', `#${slug}`)
  window.dispatchEvent(new Event(SELECT_EVENT))
}

/**
 * Tabs over panels that the server renders in full. Without JavaScript every panel shows, and
 * before this script runs, CSS in globals.css shows the first panel or the one the fragment names.
 */
export function RaceTabs({ label, panels }: { label: string; panels: RacePanel[] }) {
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash.slice(1),
    () => '',
  )
  const container = useRef<HTMLDivElement>(null)
  const slugs = panels.map((panel) => panel.slug)
  const selected = slugs.includes(hash) ? hash : (slugs[0] ?? '')

  // React has no type for hidden="until-found", which lets find-in-page reach a hidden panel.
  // Chrome still exposes such a panel's role, so aria-hidden keeps it from a screen reader.
  useLayoutEffect(() => {
    if (!ready) return
    for (const panel of container.current?.querySelectorAll<HTMLElement>('[data-panel]') ?? []) {
      if (panel.id === selected) {
        panel.removeAttribute('hidden')
        panel.removeAttribute('aria-hidden')
      } else {
        panel.setAttribute('hidden', 'until-found')
        panel.setAttribute('aria-hidden', 'true')
      }
    }
  }, [ready, selected])

  useEffect(() => {
    const root = container.current
    const onMatch = (event: Event) => {
      const panel = (event.target as HTMLElement).closest<HTMLElement>('[data-panel]')
      if (panel !== null) select(panel.id)
    }
    root?.addEventListener('beforematch', onMatch)
    return () => root?.removeEventListener('beforematch', onMatch)
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    const index = slugs.indexOf(selected)
    const last = slugs.length - 1
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    const slug = slugs[next] as string
    select(slug)
    container.current?.querySelector<HTMLElement>(`#tab-${slug}`)?.focus()
  }

  return (
    <div ref={container} className="race-tabs mt-6" data-ready={ready ? '' : undefined}>
      <div
        role={ready ? 'tablist' : undefined}
        aria-label={ready ? label : undefined}
        className="border-line flex flex-wrap gap-2 border-b pb-3"
      >
        {panels.map((panel) => {
          const current = panel.slug === selected
          return (
            <a
              key={panel.slug}
              id={`tab-${panel.slug}`}
              href={`#${panel.slug}`}
              role={ready ? 'tab' : undefined}
              aria-selected={ready ? current : undefined}
              aria-controls={ready ? panel.slug : undefined}
              tabIndex={ready && !current ? -1 : undefined}
              onClick={(event) => {
                if (!ready) return
                event.preventDefault()
                select(panel.slug)
              }}
              onKeyDown={onKeyDown}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                current ? 'bg-ink text-white' : 'bg-surface text-ink'
              }`}
            >
              {panel.label}
            </a>
          )
        })}
      </div>
      {panels.map((panel) => (
        <section
          key={panel.slug}
          id={panel.slug}
          data-panel=""
          data-race={panel.slug}
          role={ready ? 'tabpanel' : undefined}
          aria-labelledby={ready ? `tab-${panel.slug}` : undefined}
          tabIndex={ready ? 0 : undefined}
          className="scroll-mt-4"
        >
          <div className="pt-5">{panel.content}</div>
        </section>
      ))}
    </div>
  )
}
