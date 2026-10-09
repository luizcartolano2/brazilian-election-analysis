'use client'

import { useState, type FormEvent } from 'react'
import { AppLink } from '@/components/app-link'
import type { DrilldownConfig } from '@/lib/drilldown/config'
import { browserLocate, browserRunner } from '@/lib/drilldown/browser'
import { searchPlaces, type PlaceMatch } from '@/lib/drilldown/queries'
import { t, type Locale } from '@/lib/i18n'

type Result =
  | { status: 'idle' | 'searching' | 'failed' }
  | { status: 'done'; places: PlaceMatch[]; truncated: boolean }

/** "Find your polling station": part of a place's name or address, within one municipality. */
export function PlaceSearch({
  locale,
  config,
  area,
  municipality,
  stationHref,
}: {
  locale: Locale
  config: DrilldownConfig
  area: string
  municipality: number
  stationHref: (zone: number, station: number) => string
}) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<Result>({ status: 'idle' })

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (text.trim() === '') {
      setResult({ status: 'idle' })
      return
    }
    setResult({ status: 'searching' })
    try {
      const run = await browserRunner(config)
      const found = await searchPlaces(run, browserLocate(config), area, municipality, text)
      setResult({ status: 'done', ...found })
    } catch {
      setResult({ status: 'failed' })
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-extrabold">{t(locale, 'search.title')}</h2>
      <form onSubmit={submit} className="mt-2 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="place-search">
          {t(locale, 'search.label')}
        </label>
        <input
          id="place-search"
          type="search"
          value={text}
          maxLength={100}
          onChange={(event) => setText(event.target.value)}
          placeholder={t(locale, 'search.label')}
          className="border-ink/20 min-w-0 flex-1 rounded border px-2 py-1 text-sm"
        />
        <button type="submit" className="border-ink/30 rounded border px-3 py-1 text-sm">
          {t(locale, 'search.button')}
        </button>
      </form>
      {result.status === 'searching' && (
        <p className="text-muted mt-2 text-sm">{t(locale, 'search.searching')}</p>
      )}
      {result.status === 'failed' && (
        <p role="alert" className="mt-2 text-sm">
          {t(locale, 'search.failed')}
        </p>
      )}
      {result.status === 'done' &&
        (result.places.length === 0 ? (
          <p className="mt-2 text-sm" data-testid="search-none">
            {t(locale, 'search.none')}
          </p>
        ) : (
          <>
            {result.truncated && (
              <p className="mt-2 text-sm" data-testid="search-truncated">
                {t(locale, 'search.truncated')}
              </p>
            )}
            <ul className="mt-3 space-y-3 text-sm" data-testid="search-results">
              {result.places.map((place) => (
                <li key={`${place.zone}-${place.place}-${place.address}`}>
                  <p className="font-medium break-words">{place.place}</p>
                  <p className="text-muted break-words">
                    {[place.address, place.neighborhood].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3">
                    <span className="text-muted">{t(locale, 'search.stations')}:</span>
                    {place.stations.map((station) => (
                      <AppLink
                        key={station.station}
                        href={stationHref(place.zone, station.station)}
                        className="underline"
                      >
                        {station.station}
                      </AppLink>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          </>
        ))}
    </section>
  )
}
