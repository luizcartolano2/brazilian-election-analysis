'use client'

import type { Locale } from '@/lib/i18n'
import { shownColumns, TABLES } from '@/lib/playground/catalog'
import { sizeOf, type DataChoice } from '@/lib/playground/choice'
import { formatBytes } from '@/lib/playground/display'
import { tableFiles, type PlaygroundFile } from '@/lib/playground/files'
import { fill, type Labels } from './labels'

/** Each table, its size for the choice, and what each column holds. */
export function TablesPanel({
  locale,
  labels,
  files,
  choice,
}: {
  locale: Locale
  labels: Labels
  files: PlaygroundFile[] | null
  choice: DataChoice
}) {
  return (
    <details className="border-line rounded-lg border bg-white" data-testid="playground-tables">
      <summary className="flex cursor-pointer list-none justify-between px-3 py-2 text-sm font-semibold">
        {fill(labels['playground.tablesTitle'], { count: String(TABLES.length) })}
        <span aria-hidden="true">▸</span>
      </summary>
      <div className="px-3 pb-3">
        <p className="text-muted text-xs">{labels['playground.tablesNote']}</p>
        {TABLES.map((table) => (
          <details key={table.name} className="border-line mt-2 border-t pt-2">
            <summary className="flex cursor-pointer list-none justify-between gap-3 text-sm">
              <span className="font-mono font-semibold">{table.name}</span>
              <span className="text-muted text-xs" data-testid={`table-size-${table.name}`}>
                {files === null
                  ? '…'
                  : formatBytes(locale, sizeOf(tableFiles(files, choice, table.name)))}
              </span>
            </summary>
            <p className="text-muted mt-1 text-xs">{table[locale]}</p>
            <dl className="mt-1 grid grid-cols-[auto_auto_1fr] gap-x-3 gap-y-1 text-xs">
              {shownColumns(table).map((column) => (
                <div key={column.name} className="contents">
                  <dt className="font-mono">{column.name}</dt>
                  <dd className="text-muted">{column.type}</dd>
                  <dd className="text-muted">{column[locale]}</dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </div>
    </details>
  )
}
