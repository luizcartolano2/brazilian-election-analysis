import { AppLink } from '@/components/app-link'
import { municipalityHref } from '@/lib/address'
import { getRaceMap } from '@/lib/data'
import type { RaceInfo } from '@/lib/elections'
import { formatPoints, t, type Locale } from '@/lib/i18n'
import { closestRows, marginPoints, type MapData } from '@/lib/maps'
import { hasMap } from '@/views/map-section'

const SHOWN = 5

/** The municipalities where a race's two most voted are closest, from the race's own map values. */
export function ClosestMunicipalities({
  locale,
  area,
  race,
}: {
  locale: Locale
  area: string
  race: RaceInfo
}) {
  if (!hasMap(area)) return null
  return <ClosestList locale={locale} area={area} race={race} data={getRaceMap(area, race.code)} />
}

export function ClosestList({
  locale,
  area,
  race,
  data,
}: {
  locale: Locale
  area: string
  race: RaceInfo
  data: MapData
}) {
  const rows = closestRows(data, SHOWN)
  if (rows.length === 0) return null
  return (
    <section className="mt-8" data-testid="closest">
      <h3 className="text-xl font-bold">{t(locale, 'closest.title')}</h3>
      <p className="text-muted mt-1 text-sm">{t(locale, 'closest.note')}</p>
      <ol className="divide-line border-line mt-3 divide-y border-y">
        {rows.map((row) => {
          const [, municipio, name, first, firstVotes, second, secondVotes] = row
          return (
            <li
              key={municipio}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm"
            >
              <span>
                <AppLink
                  href={municipalityHref(locale, area, municipio, race)}
                  className="font-semibold underline"
                >
                  {name}
                </AppLink>{' '}
                <span className="text-muted">
                  {t(locale, 'closest.between', {
                    first: data.units[first] ?? '',
                    second: data.units[second] ?? '',
                  })}
                </span>
              </span>
              <span className="font-semibold tabular-nums">
                {firstVotes === secondVotes && `${t(locale, 'map.tie')} · `}
                {t(locale, 'map.points', { points: formatPoints(locale, marginPoints(row)) })}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
