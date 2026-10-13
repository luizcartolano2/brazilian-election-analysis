'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Round } from '@/lib/elections'
import type { Locale } from '@/lib/i18n'
import { isBrazil, type DataChoice } from '@/lib/playground/choice'
import type { PlaygroundConfig } from '@/lib/playground/config'
import { csvFileName } from '@/lib/playground/csv'
import { sha256Hex } from '@/lib/playground/digest'
import { formatBytes } from '@/lib/playground/display'
import { EXAMPLES } from '@/lib/playground/examples'
import {
  choiceFiles,
  unlistFiles,
  type ListedCandidate,
  type ListedFile,
  type PlaygroundFile,
} from '@/lib/playground/files'
import { formQuery, type FormState } from '@/lib/playground/form'
import {
  linkFragment,
  MAX_QUERY_LENGTH,
  readLink,
  type LinkReading,
  type LinkState,
} from '@/lib/playground/link'
import type { ResultCollector } from '@/lib/playground/result'
import { Runner, type FailureReason, type RunPlan } from '@/lib/playground/runner'
import type { ColumnProblem } from '@/lib/playground/sandbox'
import { DataChoiceBar, roundLabel } from './data-choice'
import { fill, type Labels } from './labels'
import { QueryForm, type CandidateChoices, type CandidateOption } from './query-form'
import { ResultFrame, type ShownResult } from './result-frame'
import { TablesPanel } from './tables-panel'

const INITIAL_CHOICE: DataChoice = { rounds: [1], races: [1], areas: ['br'] }
const INITIAL_FORM: FormState = {
  question: 'each',
  level: 'uf',
  race: 1,
  candidate: null,
  order: 'desc',
  rows: 100,
}

/** Where the editor's text comes from. Only text that the visitor typed is theirs to keep. */
type Source =
  | { kind: 'form' }
  | { kind: 'example'; text: string }
  | { kind: 'link'; text: string }
  | { kind: 'typed'; text: string }

type Phase =
  | { kind: 'idle' }
  | { kind: 'confirm'; bytes: number }
  | { kind: 'starting' }
  | { kind: 'downloading'; received: number; total: number }
  | { kind: 'running'; since: number }
  | { kind: 'cancelled' }
  | { kind: 'failed'; reason: FailureReason; message: string; problems: ColumnProblem[] }

interface Result {
  shown: ShownResult
  collector: ResultCollector
  link: string
  versions: { round: Round; version: string }[]
}

type Listing =
  { status: 'loading' } | { status: 'failed' } | { status: 'ready'; files: PlaygroundFile[] }

/** A slow list fails with an error and a retry instead of keeping the page loading. */
const LIST_TIMEOUT_MS = 30_000

async function checkedJson<T>(url: string, sha256: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(LIST_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  const bytes = await response.arrayBuffer()
  if ((await sha256Hex(bytes)) !== sha256) throw new Error(`${url} differs from its pin`)
  return JSON.parse(new TextDecoder().decode(bytes)) as T
}

function noSubscription() {
  return () => {}
}

/** The playground, once the page runs in a browser: the static page holds only its frame. */
export function Playground(props: {
  locale: Locale
  config: PlaygroundConfig
  labels: Labels
  sourcesHref: string
}) {
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
  return hydrated ? <PlaygroundApp {...props} /> : null
}

function Notice({ tone, children }: { tone: 'amber' | 'red' | 'gray'; children: ReactNode }) {
  const tones = {
    amber: 'bg-amber-100 text-amber-900',
    red: 'bg-red-100 text-red-900',
    gray: 'bg-surface',
  }
  return (
    <div className={`mt-4 rounded-xl p-3 text-sm ${tones[tone]}`} role="status">
      {children}
    </div>
  )
}

function PlaygroundApp({
  locale,
  config,
  labels,
  sourcesHref,
}: {
  locale: Locale
  config: PlaygroundConfig
  labels: Labels
  sourcesHref: string
}) {
  // A link never runs anything by itself.
  const [reading, setReading] = useState<LinkReading>(() =>
    readLink(window.location.hash, config.versions),
  )
  const restored = reading.status === 'valid' ? reading.state : null
  const [choice, setChoice] = useState<DataChoice>(restored?.choice ?? INITIAL_CHOICE)
  const [form, setForm] = useState<FormState>({
    ...INITIAL_FORM,
    race: restored?.choice.races[0] ?? INITIAL_FORM.race,
  })
  const [source, setSource] = useState<Source>(
    restored === null ? { kind: 'form' } : { kind: 'link', text: restored.sql },
  )
  const [ask, setAsk] = useState<{ apply: () => void } | null>(null)
  const [listing, setListing] = useState<Listing>({ status: 'loading' })
  const [listAttempt, setListAttempt] = useState(0)
  const [candidateLists, setCandidateLists] = useState<
    Record<string, Record<string, ListedCandidate[]> | 'failed'>
  >({})
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  // A holder rather than a ref, so the cleanup below reaches the runner that the page made.
  const [engine] = useState<{ runner: Runner | null }>(() => ({ runner: null }))
  const progress = useRef<{ received: number; total: number } | null>(null)

  useEffect(() => {
    let current = true
    checkedJson<Record<string, ListedFile[]>>(`${config.base}/arquivos.json`, config.filesSha256)
      .then((listed) => {
        const files = Object.entries(listed).flatMap(([round, entries]) =>
          unlistFiles(Number(round) as Round, entries),
        )
        if (current) setListing({ status: 'ready', files })
      })
      .catch(() => {
        if (current) setListing({ status: 'failed' })
      })
    return () => {
      current = false
    }
  }, [config.base, config.filesSha256, listAttempt])

  // The form follows the data choice: its race is one of the chosen races.
  const race = choice.races.includes(form.race) ? form.race : (choice.races[0] ?? form.race)
  const candidateKey = `${choice.rounds[0] ?? 1}-${race}`
  const listedCandidates = candidateLists[candidateKey]
  const candidateSha = config.candidatesSha256[candidateKey]

  useEffect(() => {
    if (form.question !== 'one' || listedCandidates !== undefined) return
    let current = true
    const loading =
      candidateSha === undefined
        ? Promise.reject(new Error('no list'))
        : checkedJson<Record<string, ListedCandidate[]>>(
            `${config.base}/candidatos-${candidateKey}.json`,
            candidateSha,
          )
    loading
      .then((lists) => {
        if (current) setCandidateLists((known) => ({ ...known, [candidateKey]: lists }))
      })
      .catch(() => {
        if (current) setCandidateLists((known) => ({ ...known, [candidateKey]: 'failed' }))
      })
    return () => {
      current = false
    }
  }, [form.question, listedCandidates, candidateKey, candidateSha, config.base])

  const candidates: CandidateChoices = (() => {
    if (listedCandidates === undefined) return { status: 'loading' }
    if (listedCandidates === 'failed') return { status: 'failed' }
    const areas =
      race === 1 ? ['br'] : isBrazil(choice) ? Object.keys(listedCandidates) : choice.areas
    const named = areas.length > 1
    const options: CandidateOption[] = areas.flatMap((area) =>
      (listedCandidates[area] ?? []).map(([numero, nome, partido]) => ({
        candidate: { area, numero },
        label: `${named ? `${area.toUpperCase()} · ` : ''}${numero} · ${nome}${partido === '' ? '' : ` (${partido})`}`,
      })),
    )
    return { status: 'ready', options }
  })()

  const candidate =
    candidates.status === 'ready'
      ? (candidates.options.find(
          (option) =>
            option.candidate.area === form.candidate?.area &&
            option.candidate.numero === form.candidate?.numero,
        )?.candidate ??
        candidates.options[0]?.candidate ??
        null)
      : null
  const effectiveForm: FormState = { ...form, race, candidate }

  const complete = choice.rounds.length > 0 && choice.races.length > 0 && choice.areas.length > 0
  let generated = ''
  if (complete) {
    try {
      generated = formQuery(effectiveForm, choice)
    } catch {
      generated = ''
    }
  }
  const sql = source.kind === 'form' ? generated : source.text
  const busy = phase.kind === 'starting' || phase.kind === 'downloading' || phase.kind === 'running'

  // Leaving the page stops the engine's Worker, with every file it holds.
  useEffect(() => () => engine.runner?.dispose(), [engine])

  useEffect(() => {
    if (phase.kind !== 'running') return
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [phase.kind])

  /** Replaces the editor's text, after asking when the visitor typed it. */
  function replaceText(apply: () => void) {
    if (source.kind === 'typed') setAsk({ apply })
    else apply()
  }

  function changeForm(next: FormState) {
    setForm(next)
    replaceText(() => setSource({ kind: 'form' }))
  }

  function openLink(state: LinkState) {
    setChoice(state.choice)
    setForm((current) => ({ ...current, race: state.choice.races[0] ?? current.race }))
    setSource({ kind: 'link', text: state.sql })
  }

  // A link pasted into an open page changes only the fragment. The page opens it in place, and
  // asks before it replaces a query that the visitor typed.
  useEffect(() => {
    const open = () => {
      const next = readLink(window.location.hash, config.versions)
      if (next.status === 'none') return
      if (next.status === 'invalid') {
        setReading(next)
        return
      }
      replaceText(() => {
        setReading(next)
        openLink(next.state)
      })
    }
    window.addEventListener('hashchange', open)
    return () => window.removeEventListener('hashchange', open)
  })

  function chooseExample(id: string) {
    const example = EXAMPLES.find((entry) => entry.id === id)
    if (example === undefined) return
    replaceText(() => {
      setChoice(example.choice)
      setForm((current) => ({ ...current, race: example.choice.races[0] ?? current.race }))
      setSource({ kind: 'example', text: example.sql })
    })
  }

  function versionsRead(plan: RunPlan): { round: Round; version: string }[] {
    const rounds = new Set([...plan.tables.values()].flat().map((file) => file.round))
    return [...rounds].sort().map((round) => ({ round, version: config.versions[round] ?? '' }))
  }

  function linkTo(text: string, chosen: DataChoice, read: { round: Round; version: string }[]) {
    const versions: Partial<Record<Round, string>> = {}
    for (const round of chosen.rounds) versions[round] = config.versions[round]
    for (const entry of read) versions[entry.round] = entry.version
    const fragment = linkFragment({ versions, choice: chosen, sql: text })
    return `${window.location.origin}${window.location.pathname}${fragment}`
  }

  /** `confirmed` is the size that the visitor agreed to download, which a later edit can pass. */
  function run(confirmed = 0) {
    if (listing.status !== 'ready' || busy || !complete) return
    engine.runner ??= new Runner(
      { assetBase: config.assetBase, workerScript: config.workerScript },
      config.dataBase,
    )
    const active = engine.runner
    const plan = active.plan(sql, choice, listing.files)
    if (plan.missingBytes > config.confirmBytes && plan.missingBytes > confirmed) {
      setPhase({ kind: 'confirm', bytes: plan.missingBytes })
      return
    }
    const ranSql = sql
    const ranChoice = choice
    setResult(null)
    setCopied(false)
    setPhase({ kind: 'starting' })
    let frame = 0
    void active
      .run(plan, choice, choiceFiles(listing.files, choice), {
        onDownload: (received, total) => {
          progress.current = { received, total }
          frame ||= requestAnimationFrame(() => {
            frame = 0
            const latest = progress.current
            if (latest !== null) setPhase({ kind: 'downloading', ...latest })
          })
        },
        onQuery: () => {
          cancelAnimationFrame(frame)
          setNow(Date.now())
          setPhase({ kind: 'running', since: Date.now() })
        },
      })
      .then((outcome) => {
        cancelAnimationFrame(frame)
        if (outcome.status === 'cancelled') {
          setPhase({ kind: 'cancelled' })
          return
        }
        if (outcome.status === 'failed') {
          setPhase({
            kind: 'failed',
            reason: outcome.reason,
            message: outcome.message,
            problems: outcome.problems ?? [],
          })
          return
        }
        const versions = versionsRead(plan)
        const collector = outcome.collector
        setResult({
          collector,
          versions,
          link: linkTo(ranSql, ranChoice, versions),
          shown: {
            sql: ranSql,
            columns: collector.columns,
            rows: collector.shown,
            rowCount: collector.rows,
            passed: collector.passed,
            seconds: outcome.seconds,
            versionLines: versions.map((entry) =>
              fill(labels['playground.captionVersion'], {
                round: roundLabel(labels, entry.round),
                version: entry.version,
              }),
            ),
          },
        })
        setPhase({ kind: 'idle' })
      })
  }

  function copyLink() {
    if (result === null) return
    const fragment = result.link.slice(result.link.indexOf('#'))
    history.replaceState(null, '', fragment)
    void navigator.clipboard?.writeText(result.link).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  function download() {
    if (result === null || result.shown.passed !== null) return
    const comments = [
      labels['footer.credit'],
      ...result.shown.versionLines,
      fill(labels['playground.csvQuery'], { link: result.link }),
    ]
    const parts = result.collector.fileParts(comments)
    const url = URL.createObjectURL(new Blob(parts, { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = csvFileName(result.versions)
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  const size = (bytes: number) => formatBytes(locale, bytes)
  // The engine's own refusal, of a file or of a change to its settings, gets its own sentence.
  const refused =
    phase.kind === 'failed' &&
    phase.reason === 'query' &&
    (phase.message.startsWith('Permission Error') ||
      phase.message.includes('configuration has been locked'))
  const failureKey =
    phase.kind !== 'failed'
      ? null
      : refused
        ? 'playground.failed.refused'
        : (`playground.failed.${phase.reason}` as const)

  return (
    <div data-testid="playground">
      {reading.status === 'invalid' && (
        <Notice tone="red">{labels['playground.linkInvalid']}</Notice>
      )}
      {reading.status === 'valid' && reading.stale.length > 0 && (
        <Notice tone="amber">
          {reading.stale.map((entry) => (
            <p key={entry.round}>
              {fill(labels['playground.linkStale'], {
                linked: entry.linked,
                pinned: entry.pinned,
                round: roundLabel(labels, entry.round),
              })}
            </p>
          ))}
        </Notice>
      )}
      {reading.status === 'valid' && reading.stale.length === 0 && (
        <Notice tone="gray">{labels['playground.linkRestored']}</Notice>
      )}
      <div className="mt-4">
        <DataChoiceBar
          locale={locale}
          config={config}
          labels={labels}
          choice={choice}
          onChange={(next) => {
            // With no round chosen, every race stays chosen until a round comes back.
            const races =
              next.rounds.length === 0
                ? next.races
                : next.races.filter((code) =>
                    config.races.some(
                      (entry) =>
                        entry.code === code &&
                        entry.rounds.some((round) => next.rounds.includes(round)),
                    ),
                  )
            setChoice({ ...next, races })
          }}
        />
      </div>
      {!complete && (
        <p className="mt-2 text-sm text-amber-900">{labels['playground.choiceIncomplete']}</p>
      )}
      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="border-line rounded-xl border p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{labels['playground.formTitle']}</h2>
            <select
              aria-label={labels['playground.examples']}
              className="border-line w-full min-w-0 rounded-lg border bg-white px-3 py-1.5 text-sm sm:w-48"
              value=""
              onChange={(event) => chooseExample(event.target.value)}
            >
              <option value="">{labels['playground.examples']}</option>
              {EXAMPLES.map((example) => (
                <option key={example.id} value={example.id} title={example[locale].description}>
                  {example[locale].title}
                </option>
              ))}
            </select>
          </div>
          {choice.races.length > 0 ? (
            <QueryForm
              locale={locale}
              labels={labels}
              choice={choice}
              form={effectiveForm}
              candidates={candidates}
              onChange={changeForm}
            />
          ) : null}
        </section>
        <section className="min-w-0">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <label
              htmlFor="playground-sql"
              className="text-muted text-xs font-bold tracking-wider uppercase"
            >
              {labels['playground.sqlTitle']}
            </label>
            <span className="text-muted text-xs">
              {source.kind === 'typed'
                ? labels['playground.sqlTyped']
                : source.kind === 'form'
                  ? labels['playground.sqlFromForm']
                  : ''}
            </span>
          </div>
          <textarea
            id="playground-sql"
            maxLength={MAX_QUERY_LENGTH}
            className="border-ink min-h-72 w-full rounded-lg border bg-white p-3 font-mono text-xs leading-relaxed"
            spellCheck={false}
            value={sql}
            onChange={(event) => setSource({ kind: 'typed', text: event.target.value })}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault()
                run()
              }
            }}
          />
          {sql.length >= MAX_QUERY_LENGTH && (
            <p className="mt-1 text-xs text-amber-900" data-testid="playground-too-long">
              {labels['playground.queryTooLong']}
            </p>
          )}
          {ask !== null && (
            <div className="bg-surface mt-2 rounded-xl p-3 text-sm" role="alertdialog">
              <p>{labels['playground.replaceAsk']}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="bg-ink rounded-full px-4 py-1.5 font-bold text-white"
                  onClick={() => {
                    ask.apply()
                    setAsk(null)
                  }}
                >
                  {labels['playground.replace']}
                </button>
                <button
                  type="button"
                  className="border-line rounded-full border bg-white px-4 py-1.5 font-bold"
                  onClick={() => setAsk(null)}
                >
                  {labels['playground.keep']}
                </button>
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {busy ? (
              <button
                type="button"
                className="border-line rounded-full border bg-white px-5 py-2 text-sm font-bold"
                onClick={() => engine.runner?.cancel()}
              >
                ■ {labels['playground.cancel']}
              </button>
            ) : (
              <button
                type="button"
                className="bg-ink rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
                disabled={listing.status !== 'ready' || !complete}
                onClick={() => run()}
              >
                ▶ {labels['playground.run']}
              </button>
            )}
            <span className="text-muted text-xs">{labels['playground.runHint']}</span>
          </div>
          <div className="mt-3">
            <TablesPanel
              locale={locale}
              labels={labels}
              files={listing.status === 'ready' ? listing.files : null}
              choice={choice}
            />
          </div>
        </section>
      </div>
      <div data-testid="playground-status">
        {listing.status === 'failed' && (
          <Notice tone="red">
            {labels['playground.failed.list']}{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => {
                setListing({ status: 'loading' })
                setListAttempt((attempt) => attempt + 1)
              }}
            >
              {labels['playground.retry']}
            </button>
          </Notice>
        )}
        {phase.kind === 'confirm' && (
          <Notice tone="amber">
            <p className="font-bold">
              {fill(labels['playground.confirmTitle'], { size: size(phase.bytes) })}
            </p>
            <p>{labels['playground.confirmNote']}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="bg-ink rounded-full px-4 py-1.5 font-bold text-white"
                onClick={() => run(phase.bytes)}
              >
                {labels['playground.confirm']}
              </button>
              <button
                type="button"
                className="rounded-full border border-amber-300 bg-white px-4 py-1.5 font-bold"
                onClick={() => setPhase({ kind: 'idle' })}
              >
                {labels['playground.back']}
              </button>
            </div>
          </Notice>
        )}
        {phase.kind === 'starting' && <Notice tone="gray">{labels['playground.starting']}</Notice>}
        {phase.kind === 'downloading' && (
          <Notice tone="gray">
            {fill(labels['playground.downloading'], {
              received: size(phase.received),
              total: size(phase.total),
            })}
            <div className="bg-line mt-2 h-2 overflow-hidden rounded-full">
              <div
                className="bg-ink h-full"
                style={{
                  width: `${phase.total === 0 ? 100 : (100 * phase.received) / phase.total}%`,
                }}
              />
            </div>
          </Notice>
        )}
        {phase.kind === 'running' && (
          <Notice tone="gray">
            {fill(labels['playground.running'], {
              seconds: String(Math.max(0, Math.floor((now - phase.since) / 1000))),
            })}
          </Notice>
        )}
        {phase.kind === 'cancelled' && (
          <Notice tone="gray">{labels['playground.cancelled']}</Notice>
        )}
        {phase.kind === 'failed' && failureKey !== null && (
          <Notice tone="red">
            <p>{labels[failureKey]}</p>
            {phase.problems.length > 0 && (
              <ul className="mt-2 list-disc pl-5" data-testid="playground-catalog-problems">
                {phase.problems.map((problem) => (
                  <li key={`${problem.table}-${problem.column}-${problem.kind}`}>
                    {problem.kind === 'type'
                      ? fill(labels['playground.catalog.type'], problem)
                      : fill(labels[`playground.catalog.${problem.kind}`], problem)}
                  </li>
                ))}
              </ul>
            )}
            {phase.message !== '' && (
              <pre className="mt-2 rounded-lg border border-red-200 bg-white p-2 font-mono text-xs whitespace-pre-wrap">
                {phase.message}
              </pre>
            )}
            {phase.reason !== 'query' && phase.reason !== 'empty' && (
              <button type="button" className="mt-2 font-semibold underline" onClick={() => run()}>
                {labels['playground.retry']}
              </button>
            )}
          </Notice>
        )}
      </div>
      {result !== null && (
        <ResultFrame
          locale={locale}
          labels={labels}
          result={result.shown}
          sourcesHref={sourcesHref}
          copied={copied}
          onCopyLink={copyLink}
          onDownload={download}
        />
      )}
    </div>
  )
}
