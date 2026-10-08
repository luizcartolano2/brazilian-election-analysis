/** A race's map by municipality, with its text in the page's language. */
import type { ReactNode } from 'react'
import { RaceMap, type MapLabels } from '@/components/race-map'
import { getMunicipalities, getRaceMap, getSourceInfo } from '@/lib/data'
import { raceName, type RaceInfo } from '@/lib/elections'
import { t, type Locale } from '@/lib/i18n'
import { isMappedArea, type MapKind } from '@/lib/maps'

// Fernando de Noronha lies about 350 km off the coast, and would widen Pernambuco's maps.
const NORONHA = 2605459

export function hasMap(area: string): boolean {
  return isMappedArea(area, getMunicipalities(area).length)
}

function mapLabels(
  locale: Locale,
  race: RaceInfo,
  areaLabel: string,
  kind: MapKind,
  brazil: boolean,
): MapLabels {
  const raceLabel = raceName(race, locale)
  const bins: [string, string, string] = [
    t(locale, 'map.binClose'),
    t(locale, 'map.binClear'),
    t(locale, 'map.binWide'),
  ]
  return {
    title: t(locale, 'map.title', { race: raceLabel, area: areaLabel }),
    statement: t(locale, race.proportional ? 'map.statementParty' : 'map.statement'),
    twoChoices: kind === 'senate' ? t(locale, 'map.twoChoices') : null,
    bins,
    binsLegend: t(locale, 'map.binsLegend', { close: bins[0], clear: bins[1], wide: bins[2] }),
    other: t(locale, 'map.other'),
    tie: t(locale, 'map.tie'),
    noVotes: t(locale, 'map.noVotes'),
    water: t(locale, 'map.water'),
    loading: t(locale, 'map.loading'),
    failed: t(locale, brazil ? 'map.failedBrazil' : 'map.failed'),
    noScript: t(locale, brazil ? 'map.noScriptBrazil' : 'map.noScript'),
    credits: t(locale, 'map.credits'),
    points: t(locale, 'map.points'),
    view: t(locale, 'map.view'),
    close: t(locale, 'map.close'),
    tieDetails: t(locale, 'map.tieDetails'),
    table: {
      caption: t(locale, kind === 'senate' ? 'map.tableCaptionSenate' : 'map.tableCaption', {
        race: raceLabel,
      }),
      municipality: t(locale, 'map.municipality'),
      leader: t(locale, 'map.leader'),
      margin: t(locale, 'map.margin'),
      first: t(locale, 'map.first'),
      second: t(locale, 'map.second'),
      filter: t(locale, 'map.filter'),
      sortName: t(locale, 'map.sortName'),
      sortMargin: t(locale, 'map.sortMargin'),
      count: t(locale, 'map.count'),
    },
  }
}

/** `area` is `br` for the President map of Brazil, or a state's code. */
export function MapSection({
  locale,
  area,
  areaLabel,
  race,
  table,
  children,
}: {
  locale: Locale
  area: string
  areaLabel: string
  race: RaceInfo
  table: boolean
  children?: ReactNode
}) {
  const data = getRaceMap(area, race.code)
  const source = getSourceInfo()
  const file = `${area}.json`
  const sha256 = source.geoSha256[file]
  if (sha256 === undefined) throw new Error(`the pinned boundary build has no ${file}`)
  return (
    <section className="mt-8" data-map={`${area}-${race.slug}`}>
      <h2 className="text-xl font-semibold">
        {t(locale, 'map.heading', { race: raceName(race, locale) })}
      </h2>
      <RaceMap
        locale={locale}
        data={data}
        boundary={{ url: `${source.geoBase}/${file}`, sha256 }}
        race={race.slug}
        area={area === 'br' ? undefined : area}
        inset={area === 'pe' ? NORONHA : undefined}
        labels={mapLabels(locale, race, areaLabel, data.kind, area === 'br')}
        table={table}
      >
        {children}
      </RaceMap>
    </section>
  )
}
