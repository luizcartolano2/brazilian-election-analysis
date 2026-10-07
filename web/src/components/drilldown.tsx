'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppLink } from '@/components/app-link'
import { FullResults } from '@/components/race-results'
import { PlaceSearch } from '@/components/place-search'
import {
  addressQuery,
  parseAddress,
  racesFor,
  type DrilldownAddress,
  type Level,
} from '@/lib/address'
import type { DrilldownConfig } from '@/lib/drilldown/config'
import { browserLocate, browserRunner } from '@/lib/drilldown/browser'
import { loadView, NotFound, type ViewData } from '@/lib/drilldown/queries'
import { areaByCode, areaName, raceName, YEAR } from '@/lib/elections'
import { formatInteger, localePath, t, type Locale } from '@/lib/i18n'
import { tseStationUrl } from '@/lib/tse-link'

type State =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'missing' }
  | { status: 'ready'; data: ViewData }

const VIEW_PATH: Record<Level, string> = {
  municipio: `/${YEAR}/municipio/`,
  zona: `/${YEAR}/zona/`,
  secao: `/${YEAR}/secao/`,
}

function viewHref(locale: Locale, level: Level, address: Parameters<typeof addressQuery>[0]) {
  return `${localePath(locale, VIEW_PATH[level])}${addressQuery(address)}`
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="mt-4 rounded bg-slate-50 p-4 text-sm">{children}</div>
}

/** A municipality, zone or polling station, read in the browser from the pinned version. */
export function Drilldown({
  locale,
  level,
  config,
}: {
  locale: Locale
  level: Level
  config: DrilldownConfig
}) {
  const search = useSearchParams().toString()
  const address = useMemo(
    () => parseAddress(level, new URLSearchParams(search), config.areaRaces),
    [level, search, config],
  )
  const [attempt, setAttempt] = useState(0)
  // A result belongs to one address and one attempt. Any other key reads as still loading.
  const requestKey = `${search}#${attempt}`
  const [settled, setSettled] = useState<{ key: string; state: State } | null>(null)
  const state: State =
    settled !== null && settled.key === requestKey ? settled.state : { status: 'loading' }

  useEffect(() => {
    if (address === null) return
    let current = true
    const settle = (next: State) => {
      if (current) setSettled({ key: requestKey, state: next })
    }
    const shape = config.shapes[address.area]?.[address.race.code]
    browserRunner(config)
      .then((run) => {
        if (shape === undefined) throw new Error('no seats recorded for this race')
        return loadView(run, browserLocate(config), address, shape)
      })
      .then((data) => settle({ status: 'ready', data }))
      .catch((error: unknown) =>
        settle({ status: error instanceof NotFound ? 'missing' : 'failed' }),
      )
    return () => {
      current = false
    }
  }, [address, requestKey, config])

  if (address === null) {
    return (
      <Notice>
        <p data-testid="invalid-address">{t(locale, 'drilldown.invalid')}</p>
        <p className="mt-2">
          <AppLink href={localePath(locale, `/${YEAR}/`)} className="underline">
            {t(locale, 'drilldown.backToBrazil')}
          </AppLink>
        </p>
      </Notice>
    )
  }
  const area = areaByCode(address.area)
  if (area === undefined) return null
  if (state.status === 'loading') {
    return <Notice>{t(locale, 'drilldown.loading')}</Notice>
  }
  if (state.status === 'failed') {
    return (
      <Notice>
        <p role="alert">{t(locale, 'drilldown.failed')}</p>
        <button
          type="button"
          onClick={() => setAttempt((count) => count + 1)}
          className="mt-3 rounded border border-slate-400 px-3 py-1"
        >
          {t(locale, 'drilldown.retry')}
        </button>
      </Notice>
    )
  }
  if (state.status === 'missing') {
    return (
      <Notice>
        <p data-testid="missing-place">{t(locale, 'drilldown.missing')}</p>
        <p className="mt-2">
          <AppLink href={localePath(locale, `/${YEAR}/${address.area}/`)} className="underline">
            {areaName(area, locale)}
          </AppLink>
        </p>
      </Notice>
    )
  }
  return <ViewBody locale={locale} address={address} data={state.data} config={config} />
}

function ViewBody({
  locale,
  address,
  data,
  config,
}: {
  locale: Locale
  address: DrilldownAddress
  data: ViewData
  config: DrilldownConfig
}) {
  const area = areaByCode(address.area)
  if (area === undefined) return null
  const zoneLabel = t(locale, 'drilldown.zone', { zone: String(address.zone) })
  const stationLabel = t(locale, 'drilldown.station', { station: String(address.station) })
  const title =
    address.level === 'municipio'
      ? data.municipalityName
      : address.level === 'zona'
        ? `${zoneLabel} · ${data.municipalityName}`
        : `${stationLabel} · ${zoneLabel} · ${data.municipalityName}`
  const place = { area: address.area, municipality: address.municipality, race: address.race }

  return (
    <>
      <nav aria-label={t(locale, 'nav.breadcrumbs')} className="text-sm text-slate-600">
        <ol className="flex flex-wrap gap-1">
          <li>
            <AppLink href={localePath(locale, `/${YEAR}/`)} className="underline">
              {t(locale, 'area.brazil')}
            </AppLink>
          </li>
          <li>
            ›{' '}
            <AppLink href={localePath(locale, `/${YEAR}/${area.code}/`)} className="underline">
              {areaName(area, locale)}
            </AppLink>
          </li>
          <li>
            ›{' '}
            {address.level === 'municipio' ? (
              <span aria-current="page">{data.municipalityName}</span>
            ) : (
              <AppLink href={viewHref(locale, 'municipio', place)} className="underline">
                {data.municipalityName}
              </AppLink>
            )}
          </li>
          {address.zone !== null && (
            <li>
              ›{' '}
              {address.level === 'zona' ? (
                <span aria-current="page">{zoneLabel}</span>
              ) : (
                <AppLink
                  href={viewHref(locale, 'zona', { ...place, zone: address.zone })}
                  className="underline"
                >
                  {zoneLabel}
                </AppLink>
              )}
            </li>
          )}
          {address.station !== null && (
            <li>
              › <span aria-current="page">{stationLabel}</span>
            </li>
          )}
        </ol>
      </nav>
      <h1 className="mt-3 text-2xl font-semibold break-words">{title}</h1>

      {data.station !== null && (
        <section className="mt-2 text-sm text-slate-700">
          <p>
            <span className="font-medium">{t(locale, 'drilldown.place')}:</span>{' '}
            {data.station.place}
          </p>
          <p>{[data.station.address, data.station.neighborhood].filter(Boolean).join(' · ')}</p>
          {address.station !== null && address.zone !== null && (
            <p className="mt-1">
              <a
                href={tseStationUrl(
                  address.race.election,
                  address.area,
                  address.municipality,
                  address.zone,
                  address.station,
                )}
                className="underline"
                data-testid="tse-link"
              >
                {t(locale, 'drilldown.tseLink')}
              </a>
            </p>
          )}
        </section>
      )}

      <nav aria-label={t(locale, 'drilldown.racesTitle')} className="mt-4">
        <ul className="flex flex-wrap gap-2 text-sm">
          {racesFor(address.area, address.municipality, config.areaRaces).map((race) => (
            <li key={race.code}>
              {race.code === address.race.code ? (
                <span aria-current="page" className="rounded bg-slate-800 px-2 py-1 text-white">
                  {raceName(race, locale)}
                </span>
              ) : (
                <AppLink
                  href={viewHref(locale, address.level, { ...address, race })}
                  className="rounded border border-slate-300 px-2 py-1"
                >
                  {raceName(race, locale)}
                </AppLink>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {data.station?.aggregated ? (
        <Notice>
          <p data-testid="aggregated">
            {t(locale, 'drilldown.aggregated', { principal: String(data.station.principal ?? '') })}
          </p>
          {data.station.principal !== null && address.zone !== null && (
            <p className="mt-2">
              <AppLink
                href={viewHref(locale, 'secao', {
                  ...place,
                  zone: address.zone,
                  station: data.station.principal,
                })}
                className="underline"
              >
                {t(locale, 'drilldown.principalLink', {
                  principal: String(data.station.principal),
                })}
              </AppLink>
            </p>
          )}
        </Notice>
      ) : (
        data.results !== null && (
          <section className="mt-4">
            <h2 className="text-xl font-semibold">{raceName(address.race, locale)}</h2>
            <FullResults
              locale={locale}
              info={address.race}
              results={data.results}
              caption={`${raceName(address.race, locale)} · ${title}`}
            />
          </section>
        )
      )}

      {address.level === 'municipio' && (
        <>
          <section className="mt-8">
            <h2 className="text-xl font-semibold">{t(locale, 'drilldown.zonesTitle')}</h2>
            <ul className="mt-2 grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
              {data.zones.map((zone) => (
                <li key={zone.zone}>
                  <AppLink
                    href={viewHref(locale, 'zona', { ...place, zone: zone.zone })}
                    className="underline"
                  >
                    {t(locale, 'drilldown.zone', { zone: String(zone.zone) })}
                  </AppLink>{' '}
                  <span className="text-xs text-slate-600">
                    {t(locale, 'drilldown.zoneEligible', {
                      count: formatInteger(locale, zone.eligible),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <PlaceSearch
            locale={locale}
            config={config}
            area={address.area}
            municipality={address.municipality}
            stationHref={(zone, station) => viewHref(locale, 'secao', { ...place, zone, station })}
          />
        </>
      )}

      {address.level === 'zona' && address.zone !== null && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">{t(locale, 'drilldown.stationsTitle')}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.stations.map((station) => (
              <li key={station.station}>
                <AppLink
                  href={viewHref(locale, 'secao', {
                    ...place,
                    zone: address.zone,
                    station: station.station,
                  })}
                  className="underline"
                >
                  {t(locale, 'drilldown.station', { station: String(station.station) })}
                </AppLink>{' '}
                <span className="text-xs text-slate-600">
                  {station.place}
                  {station.aggregated && ` · ${t(locale, 'drilldown.aggregatedMark')}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
