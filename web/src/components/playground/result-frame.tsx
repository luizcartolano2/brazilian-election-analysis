'use client'

import { useEffect, useRef, useState } from 'react'
import { NUMBER_LOCALES } from '@/lib/format'
import type { Locale } from '@/lib/i18n'
import { formatCell, isNumber } from '@/lib/playground/display'
import { LIMITS, type PassedLimit, type ResultColumn } from '@/lib/playground/result'
import { fill, type Labels } from './labels'

export interface ShownResult {
  sql: string
  columns: ResultColumn[]
  rows: unknown[][]
  rowCount: number
  passed: PassedLimit | null
  seconds: number
  /** One line per data version that the run read, with its round. */
  versionLines: string[]
}

const FOLDED_LINES = 4

/**
 * A result in its frame: the query, and a table whose caption says that a visitor's query
 * produced it, names the data versions and credits TSE. The caption stays in view while a wide
 * result's rows scroll, so a capture of the table always keeps it.
 */
export function ResultFrame({
  locale,
  labels,
  result,
  sourcesHref,
  copied,
  onCopyLink,
  onDownload,
}: {
  locale: Locale
  labels: Labels
  result: ShownResult
  sourcesHref: string
  copied: boolean
  onCopyLink: () => void
  onDownload: () => void
}) {
  const [unfolded, setUnfolded] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const [visibleWidth, setVisibleWidth] = useState<number | null>(null)

  useEffect(() => {
    const element = scroller.current
    if (element === null) return
    const observer = new ResizeObserver(() => setVisibleWidth(element.clientWidth))
    observer.observe(element)
    setVisibleWidth(element.clientWidth)
    return () => observer.disconnect()
  }, [])

  const lines = result.sql.split(/\r\n|\r|\n/)
  const hidden = lines.length - FOLDED_LINES
  const shownSql = unfolded || hidden <= 0 ? result.sql : lines.slice(0, FOLDED_LINES).join('\n')
  const numeric = result.columns.map((_, index) => result.rows.some((row) => isNumber(row[index])))
  const limitKey = result.passed === 'rows' ? 'playground.limitRows' : 'playground.limitBytes'
  const number = (value: number, digits = 0) =>
    new Intl.NumberFormat(NUMBER_LOCALES[locale], { maximumFractionDigits: digits }).format(value)
  const counts = [
    result.passed === null
      ? fill(labels['playground.rowCount'], {
          count: number(result.rowCount),
          seconds: number(result.seconds, 1),
        })
      : null,
    result.rowCount > result.rows.length
      ? fill(labels['playground.shownRows'], { count: number(LIMITS.shownRows) })
      : null,
  ].filter((part) => part !== null)

  return (
    <section
      className="border-line mt-5 rounded-xl border p-3 sm:p-4"
      data-testid="playground-result"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-muted text-xs font-bold tracking-wider uppercase">
          {labels['playground.resultTitle']}
        </h2>
        <button
          type="button"
          className="border-line rounded-full border bg-white px-3 py-1 text-sm font-semibold"
          onClick={onCopyLink}
        >
          {copied ? labels['playground.linkCopied'] : labels['playground.copyLink']}
        </button>
      </div>
      <pre
        className="bg-surface border-line mt-2 overflow-x-auto rounded-lg border p-3 font-mono text-xs whitespace-pre-wrap"
        data-testid="playground-result-sql"
      >
        {shownSql}
      </pre>
      {hidden > 0 && (
        <button
          type="button"
          className="mt-1 text-xs font-semibold underline"
          onClick={() => setUnfolded(!unfolded)}
          aria-expanded={unfolded}
        >
          {unfolded
            ? labels['playground.hideQuery']
            : fill(labels['playground.showQuery'], { count: String(hidden) })}
        </button>
      )}
      <div ref={scroller} className="mt-3 overflow-x-auto" data-testid="playground-result-scroll">
        <table className="w-full border-collapse text-sm">
          <caption
            className="bg-surface border-line text-muted sticky left-0 rounded-t-lg border border-b-0 px-3 py-2 text-left text-xs leading-relaxed"
            style={visibleWidth === null ? undefined : { maxWidth: visibleWidth }}
            data-testid="playground-caption"
          >
            <strong className="text-ink">{labels['playground.captionStatement']}</strong>
            {result.versionLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
            <span className="block">{labels['footer.credit']}</span>
          </caption>
          <thead>
            <tr>
              {result.columns.map((column, index) => (
                <th
                  key={`${column.name}-${index}`}
                  scope="col"
                  className={`border-line border-y px-3 py-2 font-mono text-xs font-semibold whitespace-nowrap ${numeric[index] ? 'text-right' : 'text-left'}`}
                >
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-line border-b">
                {row.map((value, index) => (
                  <td
                    key={index}
                    className={`px-3 py-1.5 whitespace-nowrap ${numeric[index] ? 'text-right tabular-nums' : ''}`}
                  >
                    {formatCell(locale, value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.rowCount === 0 && (
        <p className="text-muted mt-2 text-sm">{labels['playground.noRows']}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted text-xs" data-testid="playground-row-count">
          {counts.join(' ')}
        </p>
        {result.passed === null ? (
          <button
            type="button"
            className="bg-ink rounded-full px-4 py-2 text-sm font-bold text-white"
            onClick={onDownload}
          >
            {labels['playground.download']}
          </button>
        ) : null}
      </div>
      {result.passed === null ? (
        <p className="text-muted mt-2 text-xs">{labels['playground.csvNote']}</p>
      ) : (
        <p
          className="mt-2 rounded-lg bg-amber-100 p-3 text-sm text-amber-900"
          data-testid="playground-limit"
        >
          {labels[limitKey]}{' '}
          <a href={sourcesHref} className="underline">
            {labels['nav.sources']}
          </a>
        </p>
      )}
    </section>
  )
}
