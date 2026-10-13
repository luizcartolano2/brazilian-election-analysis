import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { rows, startSandbox, type Sandbox } from '../../../scripts/playground-sandbox'
import { EXAMPLES } from './examples'
import { scanQuery } from './tables'

describe('the examples', () => {
  let sandbox: Sandbox

  beforeAll(async () => {
    sandbox = await startSandbox()
  }, 30_000)

  afterAll(() => sandbox.stop())

  it.each(EXAMPLES.map((example) => [example.id, example] as const))(
    '%s runs on the fixtures and returns rows',
    (_, example) => {
      expect(scanQuery(example.sql).statements).toHaveLength(1)
      const result = rows(sandbox.fresh(example.choice), example.sql)
      expect(result.length).toBeGreaterThan(0)
    },
  )

  it('have distinct ids', () => {
    const ids = EXAMPLES.map((example) => example.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never speak of suspicion, fraud, anomalies, projections or transfers, in either language', () => {
    const banned = /suspei|suspic|fraud|anomal|proje[cç]|project|transfer|migra/i
    for (const example of EXAMPLES) {
      for (const text of [
        example.pt.title,
        example.pt.description,
        example.en.title,
        example.en.description,
      ]) {
        expect(text, example.id).not.toMatch(banned)
      }
    }
  })
})
