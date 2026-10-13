'use client'

import type { ReactNode } from 'react'
import { raceByCode } from '@/lib/elections'
import { NUMBER_LOCALES } from '@/lib/format'
import type { Locale } from '@/lib/i18n'
import type { DataChoice } from '@/lib/playground/choice'
import {
  ORDERS,
  PLACE_LEVELS,
  QUESTIONS,
  ROW_COUNTS,
  type Candidate,
  type FormState,
} from '@/lib/playground/form'
import type { Labels } from './labels'

export interface CandidateOption {
  candidate: Candidate
  label: string
}

export type CandidateChoices =
  { status: 'loading' } | { status: 'failed' } | { status: 'ready'; options: CandidateOption[] }

const FIELD = 'border-line w-full rounded-lg border bg-white px-3 py-1.5 text-sm'

function candidateKey(candidate: Candidate | null): string {
  return candidate === null ? '' : `${candidate.area}:${candidate.numero}`
}

/** The form that writes a query for a visitor who does not write SQL. */
export function QueryForm({
  locale,
  labels,
  choice,
  form,
  candidates,
  onChange,
}: {
  locale: Locale
  labels: Labels
  choice: DataChoice
  form: FormState
  candidates: CandidateChoices
  onChange: (form: FormState) => void
}) {
  const row = (id: string, label: string, control: ReactNode) => (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[7.5rem_1fr] sm:items-center sm:gap-3">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      {control}
    </div>
  )
  return (
    <div className="flex flex-col gap-3" data-testid="playground-form">
      {row(
        'playground-question',
        labels['playground.question'],
        <select
          id="playground-question"
          className={FIELD}
          value={form.question}
          onChange={(event) =>
            onChange({ ...form, question: event.target.value as FormState['question'] })
          }
        >
          {QUESTIONS.map((question) => (
            <option key={question} value={question}>
              {labels[`playground.question.${question}`]}
            </option>
          ))}
        </select>,
      )}
      {row(
        'playground-race',
        labels['playground.races'],
        <select
          id="playground-race"
          className={FIELD}
          value={form.race}
          onChange={(event) =>
            onChange({ ...form, race: Number(event.target.value), candidate: null })
          }
        >
          {choice.races.map((code) => (
            <option key={code} value={code}>
              {raceByCode(code)?.[locale] ?? code}
            </option>
          ))}
        </select>,
      )}
      {form.question === 'one' &&
        row(
          'playground-candidate',
          labels['playground.candidate'],
          candidates.status === 'ready' ? (
            <select
              id="playground-candidate"
              className={FIELD}
              value={candidateKey(form.candidate)}
              onChange={(event) => {
                const chosen = candidates.options.find(
                  (option) => candidateKey(option.candidate) === event.target.value,
                )
                onChange({ ...form, candidate: chosen?.candidate ?? null })
              }}
            >
              {candidates.options.map((option) => (
                <option key={candidateKey(option.candidate)} value={candidateKey(option.candidate)}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <p id="playground-candidate" className="text-muted text-sm" role="status">
              {
                labels[
                  candidates.status === 'loading'
                    ? 'playground.candidateLoading'
                    : 'playground.candidateFailed'
                ]
              }
            </p>
          ),
        )}
      {row(
        'playground-level',
        labels['playground.level'],
        <select
          id="playground-level"
          className={FIELD}
          value={form.level}
          onChange={(event) =>
            onChange({ ...form, level: event.target.value as FormState['level'] })
          }
        >
          {PLACE_LEVELS.map((level) => (
            <option key={level} value={level}>
              {labels[`playground.level.${level}`]}
            </option>
          ))}
        </select>,
      )}
      {row(
        'playground-order',
        labels['playground.order'],
        <select
          id="playground-order"
          className={FIELD}
          value={form.order}
          onChange={(event) =>
            onChange({ ...form, order: event.target.value as FormState['order'] })
          }
        >
          {ORDERS.map((order) => (
            <option key={order} value={order}>
              {labels[`playground.order.${order}`]}
            </option>
          ))}
        </select>,
      )}
      {row(
        'playground-rows',
        labels['playground.rows'],
        <select
          id="playground-rows"
          className={FIELD}
          value={form.rows === null ? 'all' : String(form.rows)}
          onChange={(event) =>
            onChange({
              ...form,
              rows: event.target.value === 'all' ? null : (Number(event.target.value) as 10),
            })
          }
        >
          {ROW_COUNTS.map((count) => (
            <option key={String(count)} value={count === null ? 'all' : String(count)}>
              {count === null
                ? labels['playground.rowsAll']
                : new Intl.NumberFormat(NUMBER_LOCALES[locale]).format(count)}
            </option>
          ))}
        </select>,
      )}
      <p className="text-muted text-xs">{labels['playground.formNote']}</p>
    </div>
  )
}
