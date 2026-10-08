/** The Brazil page's grid of states, each in the color of its most voted President candidate. */
import { AppLink } from '@/components/app-link'
import { coveredAreas, getSummary } from '@/lib/data'
import { areaName, PRESIDENT, STATES, YEAR } from '@/lib/elections'
import { formatShare, localePath, t, type Locale } from '@/lib/i18n'
import { candidateColor, OTHER, SHADES } from '@/lib/map-colors'
import { binOf, candidateRanks } from '@/lib/maps'
import { raceResults, type SummaryRace } from '@/lib/results'

// Each state's column and row on a grid of 6 by 8, roughly where it sits on the map.
const PLACES: Record<string, [column: number, row: number]> = {
  rr: [2, 0],
  ap: [4, 0],
  am: [1, 1],
  pa: [2, 1],
  ma: [3, 1],
  ce: [4, 1],
  rn: [5, 1],
  ac: [0, 2],
  ro: [1, 2],
  to: [2, 2],
  pi: [3, 2],
  pb: [4, 2],
  pe: [5, 2],
  mt: [1, 3],
  go: [2, 3],
  ba: [3, 3],
  al: [4, 3],
  se: [5, 3],
  ms: [1, 4],
  df: [2, 4],
  mg: [3, 4],
  es: [4, 4],
  pr: [1, 5],
  sp: [2, 5],
  rj: [3, 5],
  sc: [1, 6],
  rs: [1, 7],
}

function presidentRace(area: string): SummaryRace {
  const race = getSummary(area).corridas.find((entry) => entry.cargo === PRESIDENT)
  if (race === undefined) throw new Error(`${area}.json has no presidential race`)
  return race
}

export function StateTiles({ locale }: { locale: Locale }) {
  const brazil = presidentRace('br')
  const covered = new Set(coveredAreas())
  const tiles = STATES.filter((state) => covered.has(state.code)).map((state) => {
    const race = presidentRace(state.code)
    const results = raceResults(race, false)
    const [first, second] = results.candidates
    if (first === undefined) throw new Error(`${state.code}.json has no President candidate`)
    const valid = results.totals.valid
    const margin = valid > 0 ? ((first.votes - (second?.votes ?? 0)) / valid) * 100 : 0
    const rank = candidateRanks(race, brazil).get(first.number)
    const bin = binOf(margin)
    const share = formatShare(locale, first.votes, valid)
    const name = areaName(state, locale)
    const place = PLACES[state.code]
    if (place === undefined) throw new Error(`no tile place for ${state.code}`)
    return {
      code: state.code,
      name,
      leader: first.name,
      share,
      place,
      fill: rank === undefined ? OTHER : SHADES[rank][bin],
      ink: rank !== undefined && bin === 2 ? '#ffffff' : 'var(--color-ink)',
      label: t(locale, 'tiles.label', { state: name, leader: first.name, share }),
      ledByOther: rank === undefined,
    }
  })
  const leaders = raceResults(brazil, false)
    .candidates.slice(0, 2)
    .map((candidate, rank) => ({
      key: candidate.number,
      label: `${candidate.name} (${candidate.party})`,
      color: candidateColor(rank === 0 ? 0 : 1),
    }))
  const bins = {
    close: t(locale, 'map.binClose'),
    clear: t(locale, 'map.binClear'),
    wide: t(locale, 'map.binWide'),
  }

  return (
    <section id="estados" className="scroll-mt-4" data-testid="state-tiles">
      <h2 className="text-2xl font-extrabold">{t(locale, 'tiles.title')}</h2>
      <p className="text-muted mt-1 text-sm">{t(locale, 'tiles.note')}</p>
      <figure className="border-line mt-3 rounded-2xl border p-3">
        <ul className="grid grid-cols-6 gap-1">
          {tiles.map((tile) => (
            <li
              key={tile.code}
              style={{ gridColumn: tile.place[0] + 1, gridRow: tile.place[1] + 1 }}
            >
              <AppLink
                href={localePath(locale, `/${YEAR}/${tile.code}/`)}
                aria-label={tile.label}
                className="flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg leading-tight"
                style={{ background: tile.fill, color: tile.ink }}
                data-state={tile.code}
              >
                <span className="text-xs font-bold sm:text-sm">{tile.code.toUpperCase()}</span>
                <span className="text-[10px] tabular-nums sm:text-xs">{tile.share}</span>
              </AppLink>
            </li>
          ))}
        </ul>
        <figcaption className="text-muted mt-3 space-y-1 text-xs">
          <ul className="text-ink flex flex-wrap gap-x-4 gap-y-1">
            {leaders.map((leader) => (
              <li key={leader.key} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-sm"
                  style={{ background: leader.color }}
                />
                {leader.label}
              </li>
            ))}
            {tiles.some((tile) => tile.ledByOther) && (
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-sm"
                  style={{ background: OTHER }}
                />
                {t(locale, 'map.other')}
              </li>
            )}
          </ul>
          <p>{t(locale, 'map.binsLegend', bins)}</p>
          <p>{t(locale, 'footer.credit')}</p>
        </figcaption>
      </figure>
      <details className="mt-3" data-testid="state-list">
        <summary className="cursor-pointer text-sm font-semibold underline">
          {t(locale, 'tiles.listSummary')}
        </summary>
        <table className="mt-2 w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">{t(locale, 'tiles.caption')}</caption>
          <thead>
            <tr className="border-ink/20 text-muted border-b text-left text-xs">
              <th scope="col" className="py-1 pr-2 font-medium">
                {t(locale, 'tiles.state')}
              </th>
              <th scope="col" className="py-1 pr-2 font-medium">
                {t(locale, 'map.leader')}
              </th>
              <th scope="col" className="w-20 py-1 text-right font-medium">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {tiles.map((tile) => (
              <tr key={tile.code} className="border-line border-b">
                <td className="py-1.5 pr-2">
                  <AppLink
                    href={localePath(locale, `/${YEAR}/${tile.code}/presidente/`)}
                    className="underline"
                  >
                    {tile.name}
                  </AppLink>
                </td>
                <td className="py-1.5 pr-2 break-words">{tile.leader}</td>
                <td className="py-1.5 text-right tabular-nums">{tile.share}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
