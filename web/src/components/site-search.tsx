'use client'

import { useRouter } from 'next/navigation'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from 'react'
import { areaByCode, areaName, raceByCode, raceName } from '@/lib/elections'
import type { Locale } from '@/lib/i18n'
import {
  hitHref,
  MIN_QUERY_LENGTH,
  normalize,
  prepareIndex,
  search,
  type CandidacyEntry,
  type Hit,
  type IndexFile,
  type MunicipalityEntry,
  type SearchIndex,
} from '@/lib/search'

/** The box's text in the page's language, passed in so that no message file reaches the client. */
export interface SearchLabels {
  label: string
  placeholder: string
  loading: string
  failed: string
  none: string
  one: string
  /** Holds `{count}`. */
  many: string
  more: string
  brazil: string
  /** TSE's outcome to its label. */
  outcomes: Record<string, string>
}

type Loaded = { status: 'idle' | 'loading' | 'failed' } | { status: 'ready'; index: SearchIndex }

const NO_RESULTS = { hits: [] as Hit[], more: false }

const INDEX_TIMEOUT_MS = 30_000

function noSubscription() {
  return () => {}
}

async function fetchIndex(base: string): Promise<SearchIndex> {
  const [municipalities, candidacies] = await Promise.all(
    ['municipios.json', 'candidatos.json'].map(async (file) => {
      const response = await fetch(`${base}/${file}`, {
        signal: AbortSignal.timeout(INDEX_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`)
      return response.json()
    }),
  )
  return prepareIndex(
    municipalities as IndexFile<MunicipalityEntry>,
    candidacies as IndexFile<CandidacyEntry>,
  )
}

function areaLabel(locale: Locale, labels: SearchLabels, code: string): string {
  if (code === 'br') return labels.brazil
  const area = areaByCode(code)
  return area === undefined ? code.toUpperCase() : areaName(area, locale)
}

function HitLabel({ locale, labels, hit }: { locale: Locale; labels: SearchLabels; hit: Hit }) {
  if (hit.kind === 'municipality') {
    return (
      <>
        <span className="font-medium break-words">{hit.name}</span>{' '}
        <span className="text-xs text-slate-600">· {areaLabel(locale, labels, hit.area)}</span>
      </>
    )
  }
  const race = raceByCode(hit.race)
  const details = [
    `${hit.party} · ${hit.number}`,
    race === undefined ? '' : raceName(race, locale),
    areaLabel(locale, labels, hit.area),
    labels.outcomes[hit.outcome] ?? hit.outcome,
  ].filter(Boolean)
  return (
    <>
      <span className="block font-medium break-words">{hit.name}</span>
      <span className="block text-xs text-slate-600">{details.join(' · ')}</span>
    </>
  )
}

/**
 * One search box for every page. It renders nothing without JavaScript, and downloads its
 * index the first time a visitor focuses it.
 */
export function SiteSearch({
  locale,
  base,
  labels,
}: {
  locale: Locale
  base: string
  labels: SearchLabels
}) {
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
  const router = useRouter()
  const id = useId()
  const listRef = useRef<HTMLUListElement>(null)
  // Set while a request runs or after one succeeds, so that two quick events start one download.
  const indexRequest = useRef<Promise<void> | null>(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loaded, setLoaded] = useState<Loaded>({ status: 'idle' })

  const found = useMemo(
    () => (loaded.status === 'ready' ? search(loaded.index, text) : NO_RESULTS),
    [loaded, text],
  )
  const typed = normalize(text).length >= MIN_QUERY_LENGTH

  useEffect(() => {
    if (active >= 0) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function load() {
    if (indexRequest.current !== null) return
    setLoaded({ status: 'loading' })
    indexRequest.current = fetchIndex(base).then(
      (index) => setLoaded({ status: 'ready', index }),
      () => {
        indexRequest.current = null
        setLoaded({ status: 'failed' })
      },
    )
  }

  function go(hit: Hit) {
    setOpen(false)
    setActive(-1)
    router.push(hitHref(hit, locale))
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && found.hits.length > 0) {
      event.preventDefault()
      setOpen(true)
      setActive((current) => Math.min(current + 1, found.hits.length - 1))
    } else if (event.key === 'ArrowUp' && open && found.hits.length > 0) {
      event.preventDefault()
      setActive((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter' && open && found.hits.length > 0) {
      event.preventDefault()
      const hit = found.hits[Math.max(active, 0)]
      if (hit !== undefined) go(hit)
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  if (!hydrated) return null

  const listId = `${id}-list`
  const showList = open && typed && found.hits.length > 0
  let status = ''
  if (loaded.status === 'loading') status = labels.loading
  else if (loaded.status === 'failed') status = labels.failed
  else if (loaded.status === 'ready' && typed) {
    if (found.more) status = labels.more
    else if (found.hits.length === 0) status = labels.none
    else if (found.hits.length === 1) status = labels.one
    else status = labels.many.replace('{count}', String(found.hits.length))
  }

  return (
    <div className="relative w-full" data-testid="site-search">
      <label htmlFor={`${id}-input`} className="sr-only">
        {labels.label}
      </label>
      <input
        id={`${id}-input`}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${id}-option-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        maxLength={100}
        value={text}
        placeholder={labels.placeholder}
        onFocus={() => {
          setOpen(true)
          load()
        }}
        onClick={() => {
          setOpen(true)
          load()
        }}
        onChange={(event) => {
          setText(event.target.value)
          setOpen(true)
          setActive(-1)
          load()
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        className="h-8 w-full rounded border border-slate-300 px-2 text-sm"
      />
      {open && typed && loaded.status === 'ready' && (
        // Keeps the focus in the box when a press lands on an option, the scrollbar or the note.
        <div
          onMouseDown={(event) => event.preventDefault()}
          className="absolute right-0 left-0 z-10 mt-1 rounded border border-slate-200 bg-white text-sm shadow-lg"
        >
          {found.hits.length > 0 ? (
            <ul ref={listRef} id={listId} role="listbox" className="max-h-96 overflow-y-auto">
              {found.hits.map((hit, index) => (
                <li
                  key={`${hit.kind}-${hit.area}-${hit.kind === 'municipality' ? hit.municipality : `${hit.race}-${hit.number}`}`}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={index === active}
                  data-href={hitHref(hit, locale)}
                  onClick={() => go(hit)}
                  className={`cursor-pointer px-2 py-1.5 ${index === active ? 'bg-slate-100' : ''}`}
                >
                  <HitLabel locale={locale} labels={labels} hit={hit} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 py-1.5 text-slate-600">{labels.none}</p>
          )}
          {found.more && (
            <p className="border-t border-slate-100 px-2 py-1.5 text-xs text-slate-600">
              {labels.more}
            </p>
          )}
        </div>
      )}
      {loaded.status === 'failed' && <p className="mt-1 text-xs text-slate-700">{labels.failed}</p>}
      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  )
}
