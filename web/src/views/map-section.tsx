/** A race's map by municipality, with its text in the page's language. */
import type { ReactNode } from 'react'
import { RaceMap, type MapFrame, type MapLabels, type MapSource } from '@/components/race-map'
import {
  getCandidateVotes,
  getMunicipalities,
  getRaceMap,
  getSourceInfo,
  getValuesFile,
} from '@/lib/data'
import { raceName, type RaceInfo, type Round } from '@/lib/elections'
import { formatInteger, t, type Locale } from '@/lib/i18n'
import { isMappedArea, SHARE_STEPS, SWING_EDGES, type SwingData } from '@/lib/maps'

// Fernando de Noronha lies about 350 km off the coast, and would widen Pernambuco's maps.
const NORONHA = 2605459

export function hasMap(area: string): boolean {
  return isMappedArea(area, getMunicipalities(area).length)
}

/** The share steps' names, such as "de 10 a 20%" and, last, "50% ou mais". */
function stepLabels(locale: Locale, step: number): string[] {
  return Array.from({ length: SHARE_STEPS }, (_, index) =>
    index === SHARE_STEPS - 1
      ? t(locale, 'map.stepLast', { from: String(index * step) })
      : t(locale, 'map.step', { from: String(index * step), to: String((index + 1) * step) }),
  )
}

function mapLabels(
  locale: Locale,
  race: RaceInfo,
  areaLabel: string,
  data: MapFrame,
  brazil: boolean,
  /** Whether each voter chose two candidates, as the summary says. */
  twoChoices: boolean,
  round: Round,
  candidate?: string,
): MapLabels {
  const kind = data.kind
  const raceLabel = raceName(race, locale)
  const roundLabel = t(locale, round === 1 ? 'map.round1' : 'map.round2')
  const share = candidate !== undefined
  const bins: [string, string, string] = [
    t(locale, 'map.binClose'),
    t(locale, 'map.binClear'),
    t(locale, 'map.binWide'),
  ]
  return {
    title: share
      ? t(locale, 'map.shareTitle', {
          candidate,
          race: raceLabel,
          area: areaLabel,
          round: roundLabel,
        })
      : t(locale, 'map.title', { race: raceLabel, area: areaLabel, round: roundLabel }),
    statement: share
      ? t(locale, 'map.shareStatement', { candidate })
      : t(locale, race.proportional ? 'map.statementParty' : 'map.statement'),
    notes: [],
    swing: null,
    twoChoices: twoChoices ? t(locale, share ? 'map.shareTwoChoices' : 'map.twoChoices') : null,
    bins,
    steps: 'step' in data && data.step !== undefined ? stepLabels(locale, data.step) : [],
    votesCount: t(locale, 'map.votesCount'),
    binsLegend: t(locale, 'map.binsLegend', { close: bins[0], clear: bins[1], wide: bins[2] }),
    other: t(locale, 'map.other'),
    tie: t(locale, 'map.tie'),
    noVotes: t(locale, 'map.noVotes'),
    water: t(locale, 'map.water'),
    loading: t(locale, 'map.loading'),
    failed: t(locale, brazil ? 'map.failedBrazil' : 'map.failed'),
    // A share map's list loads with it, so neither reads without JavaScript.
    noScript: t(
      locale,
      brazil ? 'map.noScriptBrazil' : share ? 'map.noScriptList' : 'map.noScript',
    ),
    valuesFailed: t(locale, 'map.valuesFailed'),
    retry: t(locale, 'map.retry'),
    siteUpdated: t(locale, 'map.siteUpdated'),
    reload: t(locale, 'map.reload'),
    listLoading: t(locale, 'map.listLoading'),
    credits: [t(locale, 'footer.credit'), t(locale, 'sources.boundariesCredit')],
    points: t(locale, 'map.points'),
    view: t(locale, 'map.view'),
    close: t(locale, 'map.close'),
    tieDetails: t(locale, 'map.tieDetails'),
    table: {
      caption: share
        ? t(locale, 'map.tableCaptionShare', { candidate })
        : t(locale, kind === 'senate' ? 'map.tableCaptionSenate' : 'map.tableCaption', {
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
      votes: t(locale, 'map.votes'),
      share: t(locale, 'map.share'),
      sortShare: t(locale, 'map.sortShare'),
      count: t(locale, 'map.count'),
    },
  }
}

/** A map source's identity, so that a new source remounts the map. */
function sourceKey(mapSource: MapSource, area: string, race: RaceInfo, round: Round): string {
  switch (mapSource.kind) {
    case 'file':
      return `${mapSource.url}#${mapSource.share?.numero ?? ''}`
    case 'swing':
      return `${mapSource.files.map((file) => file.url).join(' ')}#${mapSource.swing.numero}`
    case 'inline':
      return `${area}-${race.slug}-${round}`
  }
}

function MapView({
  locale,
  area,
  race,
  round,
  mapSource,
  labels,
  heading,
  table,
  collapsed,
  name = `${area}-${race.slug}`,
  children,
}: {
  locale: Locale
  area: string
  race: RaceInfo
  round: Round
  mapSource: MapSource
  labels: MapLabels
  heading: string
  table: boolean
  collapsed?: string
  /** The section's `data-map`, which tests find it by. */
  name?: string
  children?: ReactNode
}) {
  const source = getSourceInfo()
  const file = `${area}.json`
  const sha256 = source.geoSha256[file]
  if (sha256 === undefined) throw new Error(`the pinned boundary build has no ${file}`)
  return (
    <section className="mt-8" data-map={name}>
      <h2 className="text-2xl font-extrabold">{heading}</h2>
      {/* A new source remounts the map, so it never shows the values of the page before. */}
      <RaceMap
        key={sourceKey(mapSource, area, race, round)}
        locale={locale}
        source={mapSource}
        boundary={{ url: `${source.geoBase}/${file}`, sha256 }}
        race={race.slug}
        round={round === 1 ? undefined : round}
        area={area === 'br' ? undefined : area}
        inset={area === 'pe' ? NORONHA : undefined}
        labels={labels}
        table={table}
        collapsed={collapsed}
      >
        {children}
      </RaceMap>
    </section>
  )
}

/** `area` is `br` for the President map of Brazil, or a state's code. */
export function MapSection({
  locale,
  area,
  areaLabel,
  race,
  round = 1,
  table,
  collapsed,
  children,
}: {
  locale: Locale
  area: string
  areaLabel: string
  race: RaceInfo
  round?: Round
  table: boolean
  collapsed?: string
  children?: ReactNode
}) {
  const data = getRaceMap(area, race.code, round)
  // The Brazil map has no list, so the page carries only its file's address and pin.
  const { rows: _rows, ...frame } = data
  const mapSource: MapSource =
    area === 'br'
      ? { kind: 'file', ...getValuesFile('br', String(race.code), round), frame }
      : { kind: 'inline', data }
  return (
    <MapView
      locale={locale}
      area={area}
      race={race}
      round={round}
      mapSource={mapSource}
      labels={mapLabels(
        locale,
        race,
        areaLabel,
        data,
        area === 'br',
        data.kind === 'senate',
        round,
      )}
      heading={t(locale, 'map.heading', { race: raceName(race, locale) })}
      table={table}
      collapsed={collapsed}
    >
      {children}
    </MapView>
  )
}

/**
 * One candidacy's share of the valid votes by municipality, in steps of 10 points, or of 5
 * where each voter chose two, as in the Senate. Null when the candidacy has no column to map.
 */
export function ShareMapSection({
  locale,
  area,
  areaLabel,
  race,
  numero,
  name,
  choicesPerVoter,
  round = 1,
}: {
  locale: Locale
  area: string
  areaLabel: string
  race: RaceInfo
  numero: number
  name: string
  choicesPerVoter: number
  round?: Round
}) {
  const twoChoices = choicesPerVoter > 1
  const step = twoChoices ? 5 : 10
  // The build reads the race's votes to decide, so a candidacy with no column requests nothing.
  const votes = getCandidateVotes(area, race.code, round)
  if (!votes.numbers.includes(numero)) return null
  const frame: MapFrame = { kind: 'share', step, units: [name] }
  const mapSource: MapSource = {
    kind: 'file',
    ...getValuesFile(area, `${race.code}-votos`, round),
    frame,
    share: { numero, label: name, step },
  }
  return (
    <MapView
      locale={locale}
      area={area}
      race={race}
      round={round}
      mapSource={mapSource}
      labels={mapLabels(locale, race, areaLabel, frame, false, twoChoices, round, name)}
      heading={t(locale, 'map.shareHeading')}
      table
      collapsed={t(locale, 'map.listSummary', {
        count: formatInteger(locale, votes.rows.length),
      })}
    />
  )
}

/** The swing steps' names, from "−6 p.p. ou menos" through "de −1 a +1 p.p." to "+6 p.p. ou mais". */
function swingStepLabels(locale: Locale): string[] {
  const signed = (edge: number) => (edge > 0 ? `+${edge}` : edge < 0 ? `−${-edge}` : '0')
  const edges = [...SWING_EDGES].reverse().map((edge) => -edge)
  const cuts = [...edges, ...SWING_EDGES]
  const ranges = cuts
    .slice(0, -1)
    .map((from, index) =>
      t(locale, 'map.swingStepRange', { from: signed(from), to: signed(cuts[index + 1] ?? from) }),
    )
  return [
    t(locale, 'map.swingStepLow', { points: signed(edges[0] ?? 0) }),
    ...ranges,
    t(locale, 'map.swingStepHigh', { points: signed(SWING_EDGES[SWING_EDGES.length - 1] ?? 0) }),
  ]
}

/**
 * A finalist's change in its share of the two finalists' votes between the rounds, by
 * municipality. It reads the two rounds' votes files that the page's share maps already read,
 * and links each municipality to its round-2 view.
 */
export function SwingMapSection({
  locale,
  area,
  areaLabel,
  race,
  numero,
  other,
  name,
}: {
  locale: Locale
  area: string
  areaLabel: string
  race: RaceInfo
  numero: number
  other: number
  name: string
}) {
  const frame: Omit<SwingData, 'rows'> = { kind: 'swing', units: [name] }
  const mapSource: MapSource = {
    kind: 'swing',
    files: [
      getValuesFile(area, `${race.code}-votos`, 1),
      getValuesFile(area, `${race.code}-votos`, 2),
    ],
    frame,
    swing: { numero, other, label: name },
  }
  const base = mapLabels(locale, race, areaLabel, frame, false, false, 2, name)
  const labels: MapLabels = {
    ...base,
    title: t(locale, 'map.swingTitle', {
      candidate: name,
      race: raceName(race, locale),
      area: areaLabel,
    }),
    statement: t(locale, 'map.swingStatement', { candidate: name }),
    notes: [
      t(locale, 'map.swingNoteCounts'),
      t(locale, 'map.swingNoteMix'),
      t(locale, 'map.swingNoteNot'),
      // A screenshot of Brazil's map must not pass for every vote of the country.
      ...(area === 'br' ? [t(locale, 'map.swingNoteAbroad')] : []),
    ],
    steps: swingStepLabels(locale),
    swing: {
      firstShare: t(locale, 'map.swingFirstShare'),
      secondShare: t(locale, 'map.swingSecondShare'),
      change: t(locale, 'map.swingChange'),
      noSwing: [t(locale, 'map.swingNoSwing1'), t(locale, 'map.swingNoSwing2')],
      noSwingLegend: t(locale, 'map.swingNoSwingLegend'),
      headFirst: t(locale, 'map.swingHeadFirst'),
      headSecond: t(locale, 'map.swingHeadSecond'),
      headChange: t(locale, 'map.swingHeadChange'),
      sortSwing: t(locale, 'map.swingSort'),
    },
    table: { ...base.table, caption: t(locale, 'map.swingCaption', { candidate: name }) },
  }
  return (
    <MapView
      locale={locale}
      area={area}
      race={race}
      round={2}
      mapSource={mapSource}
      labels={labels}
      heading={t(locale, 'map.swingHeading')}
      table
      collapsed={t(locale, 'map.listSummary', {
        count: formatInteger(locale, getCandidateVotes(area, race.code, 2).rows.length),
      })}
      name={`${area}-${race.slug}-variacao`}
    />
  )
}
