'use client'

import { geoIdentity, geoPath } from 'd3-geo'
import type { FeatureCollection, Geometry } from 'geojson'
import { useRouter } from 'next/navigation'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { addressQuery } from '@/lib/address'
import { areaOfIbge, raceBySlug, YEAR } from '@/lib/elections'
import { formatPoints, formatShare } from '@/lib/format'
import type { Locale } from '@/lib/i18n'
import { fillColor, NO_VOTES, OTHER, SENATE_SHADE, SHADES, WATER } from '@/lib/map-colors'
import { binOf, fillOf, marginPoints, type MapData, type MapRow } from '@/lib/maps'
import { localePath } from '@/lib/paths'
import { normalize } from '@/lib/search'

/** The map's text in the page's language, passed in so that no message file reaches the client. */
export interface MapLabels {
  title: string
  statement: string
  /** The Senate's two choices per voter. */
  twoChoices: string | null
  bins: [string, string, string]
  /** Names the bins and their limits, for maps that have them. */
  binsLegend: string
  other: string
  tie: string
  noVotes: string
  water: string
  loading: string
  failed: string
  noScript: string
  credits: string
  /** Holds `{points}`. */
  points: string
  /** Holds `{name}`. */
  view: string
  close: string
  /** Holds `{first}` and `{second}`. */
  tieDetails: string
  table: {
    caption: string
    municipality: string
    leader: string
    margin: string
    first: string
    second: string
    filter: string
    sortName: string
    sortMargin: string
    /** Holds `{shown}` and `{total}`. */
    count: string
  }
}

type Load = { status: 'idle' | 'loading' | 'failed' } | { status: 'ready'; topology: Topology }

interface Drawn {
  width: number
  height: number
  paths: { id: number; d: string }[]
  borders: string
  outline: string
  inset: { id: number; d: string; box: [number, number, number, number] } | null
}

interface Details {
  row: MapRow
  x: number
  y: number
  /** The map's width, so the box stays inside it. */
  width: number
  pinned: boolean
}

const WIDTH = 800
const INSET_SIZE = 150
const LAGOONS = new Set([4300001, 4300002])
const TIMEOUT_MS = 30_000

function noSubscription() {
  return () => {}
}

/** Downloads a boundary file, and refuses it unless its SHA-256 matches the pin. */
async function loadTopology(url: string, sha256: string): Promise<Topology> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  const bytes = await response.arrayBuffer()
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const hex = [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  if (hex !== sha256) throw new Error(`${url} differs from its pinned SHA-256`)
  return JSON.parse(new TextDecoder().decode(bytes)) as Topology
}

/** The boundary file's coordinates are already projected, so the browser only scales them. */
function draw(topology: Topology, inset: number | undefined, stateBorders: boolean): Drawn {
  const object = topology.objects.municipios as GeometryCollection
  const collection = feature(topology, object) as FeatureCollection<Geometry>
  const main: FeatureCollection<Geometry> = {
    type: 'FeatureCollection',
    features: collection.features.filter((entry) => entry.id !== inset),
  }
  const extra = collection.features.find((entry) => inset !== undefined && entry.id === inset)
  const [[x0, y0], [x1, y1]] = geoPath(geoIdentity().reflectY(true)).bounds(main)
  const top = extra === undefined ? 4 : INSET_SIZE + 12
  const mainHeight = Math.round(Math.min(WIDTH * ((y1 - y0) / (x1 - x0)), WIDTH * 1.2))
  const height = top + mainHeight + 4
  const path = geoPath(
    geoIdentity()
      .reflectY(true)
      .fitExtent(
        [
          [4, top],
          [WIDTH - 4, top + mainHeight],
        ],
        main,
      ),
  )
  const stateOf = (id: unknown) => areaOfIbge(Number(id))
  let drawnInset: Drawn['inset'] = null
  if (extra !== undefined) {
    const box: [number, number, number, number] = [
      WIDTH - INSET_SIZE - 4,
      4,
      INSET_SIZE,
      INSET_SIZE,
    ]
    const insetPath = geoPath(
      geoIdentity()
        .reflectY(true)
        .fitExtent(
          [
            [box[0] + 12, box[1] + 12],
            [box[0] + box[2] - 12, box[1] + box[3] - 24],
          ],
          extra,
        ),
    )
    drawnInset = { id: Number(extra.id), d: insetPath(extra) ?? '', box }
  }
  return {
    width: WIDTH,
    height,
    paths: main.features.map((entry) => ({ id: Number(entry.id), d: path(entry) ?? '' })),
    borders: stateBorders
      ? (path(mesh(topology, object, (a, b) => a !== b && stateOf(a.id) !== stateOf(b.id))) ?? '')
      : '',
    outline: path(mesh(topology, object, (a, b) => a === b)) ?? '',
    inset: drawnInset,
  }
}

function Swatch({ color, pattern = false }: { color: string; pattern?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-3 rounded-sm border border-slate-300 align-middle"
      style={{
        background: pattern
          ? 'repeating-linear-gradient(45deg, #e2e8f0 0 2px, #64748b 2px 4px)'
          : color,
      }}
    />
  )
}

function Legend({
  data,
  labels,
  water,
}: {
  data: MapData
  labels: MapLabels
  /** Whether the map holds a lagoon, which Rio Grande do Sul and Brazil do. */
  water: boolean
}) {
  const colored = data.units.slice(0, 2)
  return (
    <figcaption className="mt-2 space-y-1 text-xs text-slate-700">
      <p className="text-sm font-medium text-slate-900">{labels.title}</p>
      <p>{labels.statement}</p>
      {labels.twoChoices !== null && <p>{labels.twoChoices}</p>}
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {colored.map((unit, index) => (
          <li key={unit} className="flex items-center gap-1">
            {data.kind === 'senate' ? (
              <Swatch color={SENATE_SHADE[index as 0 | 1]} />
            ) : (
              SHADES[index as 0 | 1].map((shade) => <Swatch key={shade} color={shade} />)
            )}
            <span className="ml-1 break-words">{unit}</span>
          </li>
        ))}
        {data.units.length > 2 && (
          <li className="flex items-center gap-1">
            <Swatch color={OTHER} />
            <span>{labels.other}</span>
          </li>
        )}
        <li className="flex items-center gap-1">
          <Swatch color="" pattern />
          <span>{labels.tie}</span>
        </li>
        {water && (
          <li className="flex items-center gap-1">
            <Swatch color={WATER} />
            <span>{labels.water}</span>
          </li>
        )}
      </ul>
      {data.kind === 'margin' && <p>{labels.binsLegend}</p>}
      <p className="text-slate-600">{labels.credits}</p>
    </figcaption>
  )
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match)
}

function DetailsText({
  locale,
  data,
  labels,
  row,
}: {
  locale: Locale
  data: MapData
  labels: MapLabels
  row: MapRow
}) {
  const [, , name, first, firstVotes, second, secondVotes, valid] = row
  const unit = (index: number) => data.units[index] ?? ''
  if (first === -1) {
    return (
      <>
        <strong className="block">{name}</strong>
        {labels.noVotes}
      </>
    )
  }
  if (data.kind === 'senate') {
    return (
      <>
        <strong className="block">{name}</strong>
        <span className="block">
          1º {unit(first)}: {formatShare(locale, firstVotes, valid)}
        </span>
        {second !== -1 && (
          <span className="block">
            2º {unit(second)}: {formatShare(locale, secondVotes, valid)}
          </span>
        )}
      </>
    )
  }
  const margin = marginPoints(row)
  return (
    <>
      <strong className="block">{name}</strong>
      <span className="block">
        {second !== -1 && firstVotes === secondVotes
          ? fill(labels.tieDetails, { first: unit(first), second: unit(second) })
          : unit(first)}
      </span>
      {second !== -1 && firstVotes !== secondVotes && (
        <span className="block">
          {fill(labels.points, { points: formatPoints(locale, margin) })} ·{' '}
          {labels.bins[binOf(margin)]}
        </span>
      )}
    </>
  )
}

function MunicipalityTable({
  locale,
  data,
  labels,
  hrefOf,
  hydrated,
}: {
  locale: Locale
  data: MapData
  labels: MapLabels
  hrefOf: (row: MapRow) => string
  hydrated: boolean
}) {
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState<'name' | 'margin'>('name')
  const collator = useMemo(() => new Intl.Collator(locale === 'pt' ? 'pt-BR' : 'en-US'), [locale])
  const rows = useMemo(() => {
    const wanted = normalize(query)
    const kept = data.rows.filter((row) => wanted === '' || normalize(row[2]).includes(wanted))
    const byName = (a: MapRow, b: MapRow) => collator.compare(a[2], b[2])
    if (order === 'name') return kept.sort(byName)
    const marginOf = (row: MapRow) => (row[3] === -1 ? Infinity : marginPoints(row))
    return kept.sort((a, b) => marginOf(a) - marginOf(b) || byName(a, b))
  }, [data.rows, query, order, collator])
  const unit = (index: number) => (index === -1 ? '–' : (data.units[index] ?? ''))
  const senate = data.kind === 'senate'
  const table = labels.table

  return (
    <div className="mt-6">
      {hydrated && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <label className="sr-only" htmlFor={`${table.caption}-filter`}>
            {table.filter}
          </label>
          <input
            id={`${table.caption}-filter`}
            type="search"
            value={query}
            maxLength={60}
            placeholder={table.filter}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 min-w-0 flex-1 rounded border border-slate-300 px-2"
          />
          <button
            type="button"
            aria-pressed={order === 'name'}
            onClick={() => setOrder('name')}
            className={`rounded border px-2 py-1 ${order === 'name' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'}`}
          >
            {table.sortName}
          </button>
          {!senate && (
            <button
              type="button"
              aria-pressed={order === 'margin'}
              onClick={() => setOrder('margin')}
              className={`rounded border px-2 py-1 ${order === 'margin' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'}`}
            >
              {table.sortMargin}
            </button>
          )}
          <p role="status" className="w-full text-xs text-slate-600">
            {fill(table.count, { shown: String(rows.length), total: String(data.rows.length) })}
          </p>
        </div>
      )}
      <table className="w-full text-sm" data-testid="municipality-table">
        <caption className="mb-1 text-left text-xs text-slate-600">{table.caption}</caption>
        <thead>
          <tr className="border-b border-slate-300 text-left text-xs text-slate-600">
            <th scope="col" className="py-1 pr-2 font-medium">
              {table.municipality}
            </th>
            <th scope="col" className="py-1 pr-2 font-medium">
              {senate ? table.first : table.leader}
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              {senate ? table.second : table.margin}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const [ibge, , name, first, firstVotes, second, secondVotes, valid] = row
            const tie = second !== -1 && firstVotes === secondVotes
            const margin = marginPoints(row)
            return (
              <tr key={ibge} className="border-b border-slate-100 align-top">
                <td className="py-1 pr-2 break-words">
                  <a href={hrefOf(row)} className="underline">
                    {name}
                  </a>
                </td>
                {senate ? (
                  <>
                    <td className="py-1 pr-2 break-words">
                      {unit(first)}{' '}
                      <span className="text-xs text-slate-600 tabular-nums">
                        {formatShare(locale, firstVotes, valid)}
                      </span>
                    </td>
                    <td className="py-1 text-right break-words">
                      {unit(second)}{' '}
                      <span className="text-xs text-slate-600 tabular-nums">
                        {formatShare(locale, secondVotes, valid)}
                      </span>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-1 pr-2 break-words">{tie ? labels.tie : unit(first)}</td>
                    <td className="py-1 text-right tabular-nums">
                      {first === -1 || second === -1
                        ? '–'
                        : fill(labels.points, { points: formatPoints(locale, margin) })}
                      {first !== -1 && second !== -1 && !tie && (
                        <span className="block text-xs text-slate-600">
                          {labels.bins[binOf(margin)]}
                        </span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * One race's map by municipality, with its legend and credits in one frame, and optionally the
 * list of municipalities that says the same in text. `children` sit between the two.
 */
export function RaceMap({
  locale,
  data,
  boundary,
  race,
  area,
  inset,
  labels,
  table,
  children,
}: {
  locale: Locale
  data: MapData
  boundary: { url: string; sha256: string }
  race: string
  /** The state of every municipality, or nothing on the Brazil map. */
  area?: string
  /** An IBGE code drawn in its own box, such as Fernando de Noronha's. */
  inset?: number
  labels: MapLabels
  table: boolean
  children?: ReactNode
}) {
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
  const router = useRouter()
  const patternId = `tie-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const frame = useRef<HTMLDivElement>(null)
  const pointer = useRef('mouse')
  const [load, setLoad] = useState<Load>({ status: 'idle' })
  const [details, setDetails] = useState<Details | null>(null)

  useEffect(() => {
    const element = frame.current
    if (element === null) return
    let cancelled = false
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        setLoad({ status: 'loading' })
        loadTopology(boundary.url, boundary.sha256).then(
          (topology) => {
            if (!cancelled) setLoad({ status: 'ready', topology })
          },
          () => {
            if (!cancelled) setLoad({ status: 'failed' })
          },
        )
      },
      { rootMargin: '400px' },
    )
    observer.observe(element)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [boundary.url, boundary.sha256])

  const drawn = useMemo(
    () => (load.status === 'ready' ? draw(load.topology, inset, area === undefined) : null),
    [load, inset, area],
  )
  const rowsByIbge = useMemo(() => new Map(data.rows.map((row) => [row[0], row])), [data.rows])
  const raceInfo = raceBySlug(race)

  function hrefOf(row: MapRow): string {
    const state = area ?? areaOfIbge(row[0]) ?? ''
    const query =
      raceInfo === undefined
        ? `?uf=${state}&mu=${row[1]}`
        : addressQuery({ area: state, municipality: row[1], race: raceInfo })
    return `${localePath(locale, `/${YEAR}/municipio/`)}${query}`
  }

  function rowAt(event: MouseEvent<SVGElement>): MapRow | undefined {
    const id = (event.target as Element).getAttribute('data-ibge')
    return id === null ? undefined : rowsByIbge.get(Number(id))
  }

  function place(event: MouseEvent<SVGElement>, row: MapRow, pinned: boolean) {
    const box = frame.current?.getBoundingClientRect()
    setDetails({
      row,
      x: event.clientX - (box?.left ?? 0),
      y: event.clientY - (box?.top ?? 0),
      width: box?.width ?? 0,
      pinned,
    })
  }

  function colorOf(id: number): string {
    if (LAGOONS.has(id)) return WATER
    const row = rowsByIbge.get(id)
    return row === undefined ? NO_VOTES : fillColor(fillOf(row, data.kind), patternId)
  }

  const framed = (
    <figure className="mt-3 rounded border border-slate-200 p-2">
      <div ref={frame} className="relative" data-testid="race-map">
        {drawn === null ? (
          <div className="flex aspect-[4/3] items-center justify-center rounded bg-slate-50 p-4 text-center text-sm text-slate-700">
            {hydrated ? (
              load.status === 'failed' ? (
                <p role="alert">{labels.failed}</p>
              ) : (
                <p>{labels.loading}</p>
              )
            ) : (
              <noscript>{labels.noScript}</noscript>
            )}
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${drawn.width} ${drawn.height}`}
            className="block h-auto w-full"
            role="img"
            aria-label={`${labels.title}. ${labels.statement}`}
          >
            <defs>
              <pattern
                id={patternId}
                patternUnits="userSpaceOnUse"
                width="6"
                height="6"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="6" fill="#e2e8f0" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="#64748b" strokeWidth="3" />
              </pattern>
            </defs>
            <g
              aria-hidden="true"
              onPointerDown={(event) => {
                pointer.current = event.pointerType
              }}
              onPointerMove={(event) => {
                if (event.pointerType !== 'mouse') return
                const row = rowAt(event)
                if (row === undefined) setDetails(null)
                else place(event, row, false)
              }}
              onPointerLeave={() => setDetails((current) => (current?.pinned ? current : null))}
              onClick={(event) => {
                const row = rowAt(event)
                if (row === undefined) return
                if (pointer.current === 'mouse') router.push(hrefOf(row))
                else place(event, row, true)
              }}
            >
              {drawn.paths.map((entry) => (
                <path
                  key={entry.id}
                  d={entry.d}
                  data-ibge={entry.id}
                  fill={colorOf(entry.id)}
                  stroke={area === undefined ? 'none' : '#ffffff'}
                  strokeWidth={0.6}
                  className={rowsByIbge.has(entry.id) ? 'cursor-pointer' : undefined}
                />
              ))}
              {drawn.inset !== null && (
                <>
                  <rect
                    x={drawn.inset.box[0]}
                    y={drawn.inset.box[1]}
                    width={drawn.inset.box[2]}
                    height={drawn.inset.box[3]}
                    fill="#ffffff"
                    stroke="#94a3b8"
                  />
                  <path
                    d={drawn.inset.d}
                    data-ibge={drawn.inset.id}
                    fill={colorOf(drawn.inset.id)}
                    stroke="#ffffff"
                    strokeWidth={0.6}
                    className="cursor-pointer"
                  />
                  <text
                    x={drawn.inset.box[0] + drawn.inset.box[2] / 2}
                    y={drawn.inset.box[1] + drawn.inset.box[3] - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#334155"
                  >
                    {rowsByIbge.get(drawn.inset.id)?.[2] ?? ''}
                  </text>
                </>
              )}
            </g>
            {drawn.borders !== '' && (
              <path d={drawn.borders} fill="none" stroke="#ffffff" strokeWidth={1.2} />
            )}
            <path d={drawn.outline} fill="none" stroke="#64748b" strokeWidth={0.8} />
          </svg>
        )}
        {details !== null && (
          <div
            data-testid="map-details"
            className="absolute z-10 max-w-[16rem] rounded border border-slate-300 bg-white p-2 text-xs shadow"
            style={{
              left: Math.max(0, Math.min(details.x + 12, details.width - 260)),
              top: details.y + 12,
            }}
          >
            <DetailsText locale={locale} data={data} labels={labels} row={details.row} />
            {details.pinned && (
              <span className="mt-1 flex gap-3">
                <a href={hrefOf(details.row)} className="underline">
                  {fill(labels.view, { name: details.row[2] })}
                </a>
                <button type="button" className="underline" onClick={() => setDetails(null)}>
                  {labels.close}
                </button>
              </span>
            )}
          </div>
        )}
      </div>
      <Legend data={data} labels={labels} water={area === undefined || area === 'rs'} />
    </figure>
  )

  return (
    <>
      {framed}
      {children}
      {table && (
        <MunicipalityTable
          locale={locale}
          data={data}
          labels={labels}
          hrefOf={hrefOf}
          hydrated={hydrated}
        />
      )}
    </>
  )
}
