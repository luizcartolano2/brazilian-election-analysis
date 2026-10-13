'use client'

import { AREAS, raceByCode, type Round } from '@/lib/elections'
import type { Locale } from '@/lib/i18n'
import { BRAZIL, isBrazil, type DataChoice } from '@/lib/playground/choice'
import type { PlaygroundConfig } from '@/lib/playground/config'
import { fill, type Labels } from './labels'

function toggled<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item]
}

const PILL =
  'rounded-full border px-3 py-1 text-sm aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white border-line bg-white disabled:opacity-40'

export function roundLabel(labels: Labels, round: Round): string {
  return labels[round === 1 ? 'site.firstRound' : 'site.secondRound']
}

/** The rounds, races and areas that the playground's tables hold. */
export function DataChoiceBar({
  locale,
  config,
  labels,
  choice,
  onChange,
}: {
  locale: Locale
  config: PlaygroundConfig
  labels: Labels
  choice: DataChoice
  onChange: (choice: DataChoice) => void
}) {
  const areas = AREAS.filter((area) => config.areas.includes(area.code))
  const brazil = isBrazil(choice)
  const chosenAreas = areas.filter((area) => choice.areas.includes(area.code))
  const areaSummary = brazil
    ? labels['playground.brazil']
    : chosenAreas.length === 1
      ? (chosenAreas[0]?.[locale] ?? '')
      : fill(labels['playground.areasCount'], { count: String(chosenAreas.length) })
  return (
    <section className="bg-surface rounded-xl p-4" data-testid="playground-data">
      <h2 className="text-muted text-xs font-bold tracking-wider uppercase">
        {labels['playground.dataTitle']}
      </h2>
      <div className="mt-2 flex flex-wrap items-start gap-x-6 gap-y-3">
        <fieldset>
          <legend className="text-muted mb-1 text-xs">{labels['playground.rounds']}</legend>
          <div className="flex flex-wrap gap-2">
            {config.rounds.map((round) => (
              <button
                key={round}
                type="button"
                className={PILL}
                aria-pressed={choice.rounds.includes(round)}
                onClick={() =>
                  onChange({ ...choice, rounds: toggled(choice.rounds, round).sort() })
                }
              >
                {roundLabel(labels, round)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-muted mb-1 text-xs">{labels['playground.races']}</legend>
          <div className="flex flex-wrap gap-2">
            {config.races.map((race) => {
              const info = raceByCode(race.code)
              if (info === undefined) return null
              return (
                <button
                  key={race.code}
                  type="button"
                  className={PILL}
                  aria-pressed={choice.races.includes(race.code)}
                  disabled={!race.rounds.some((round) => choice.rounds.includes(round))}
                  onClick={() =>
                    onChange({
                      ...choice,
                      races: toggled(choice.races, race.code).sort((a, b) => a - b),
                    })
                  }
                >
                  {info[locale]}
                </button>
              )
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-muted mb-1 text-xs">{labels['playground.areas']}</legend>
          <details className="relative">
            <summary className="border-line flex min-w-48 cursor-pointer list-none justify-between gap-4 rounded-lg border bg-white px-3 py-1.5 text-sm">
              <span data-testid="playground-area-summary">{areaSummary}</span>
              <span aria-hidden="true">▾</span>
            </summary>
            <div className="border-line z-10 mt-1 max-h-80 w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border bg-white p-3 text-sm shadow-lg sm:absolute">
              <label className="flex items-start gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={brazil}
                  onChange={() => onChange({ ...choice, areas: brazil ? [] : [BRAZIL] })}
                />
                <span>
                  {labels['playground.brazil']}
                  <span className="text-muted block text-xs font-normal">
                    {labels['playground.brazilNote']}
                  </span>
                </span>
              </label>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                {areas.map((area) => (
                  <label key={area.code} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!brazil && choice.areas.includes(area.code)}
                      onChange={() =>
                        onChange({
                          ...choice,
                          areas: brazil ? [area.code] : toggled(choice.areas, area.code).sort(),
                        })
                      }
                    />
                    {area[locale]}
                  </label>
                ))}
              </div>
            </div>
          </details>
        </fieldset>
        <p className="text-muted self-end text-xs">
          {labels['playground.version']}:{' '}
          {config.rounds.map((round) => (
            <span key={round} className="mr-2 font-mono break-all">
              {config.rounds.length > 1 ? `${roundLabel(labels, round)} ` : ''}
              {config.versions[round]}
            </span>
          ))}
        </p>
      </div>
    </section>
  )
}
