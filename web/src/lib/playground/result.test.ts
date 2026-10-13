import { describe, expect, it } from 'vitest'
import { LIMITS, plainValue, ResultCollector, utf8Length } from './result'

const SMALL = { shownRows: 2, cellCharacters: 5, keptRows: 3, keptBytes: 40 }

describe('ResultCollector', () => {
  it('keeps the first rows for the table, and cuts a long cell there only', () => {
    const collector = new ResultCollector([{ name: 'texto', type: 'Utf8' }], {
      ...SMALL,
      keptBytes: 1000,
    })
    expect(collector.add([['abcdefgh'], ['b'], ['c']])).toBe(true)
    expect(collector.shown).toEqual([['abcde…'], ['b']])
    expect(collector.rows).toBe(3)
    const text = new TextDecoder().decode(collector.chunks[1])
    expect(text).toBe('abcdefgh\r\nb\r\nc\r\n')
  })

  it('stops past the row limit', () => {
    const collector = new ResultCollector([{ name: 'n', type: 'Int32' }], {
      ...SMALL,
      keptBytes: 1000,
    })
    expect(collector.add([[1], [2], [3], [4]])).toBe(false)
    expect(collector.passed).toBe('rows')
    expect(collector.rows).toBe(3)
    expect(() => collector.fileParts([])).toThrow(/limits/)
  })

  it('stops past the byte limit, whatever the row count', () => {
    const collector = new ResultCollector([{ name: 'n', type: 'Utf8' }], {
      ...SMALL,
      keptRows: 1000,
    })
    expect(collector.add([['x'.repeat(20)], ['y'.repeat(20)]])).toBe(false)
    expect(collector.passed).toBe('bytes')
    expect(collector.rows).toBe(1)
  })

  it('caps a result at 1,000,000 rows and 100 MB, and shows 1,000 rows of 500 characters', () => {
    expect(LIMITS).toEqual({
      shownRows: 1000,
      cellCharacters: 500,
      keptRows: 1_000_000,
      keptBytes: 100_000_000,
    })
  })
})

describe('plainValue', () => {
  it('writes dates and times as text, and keeps numbers as they are', () => {
    expect(plainValue(1791072000000, 'Date32<DAY>')).toBe('2026-10-04')
    expect(plainValue(1791100800000, 'Timestamp<MICROSECOND>')).toBe('2026-10-04 08:00:00')
    expect(plainValue(12345678901234567890n, 'Int64')).toBe(12345678901234567890n)
    expect(plainValue(27.28, 'Float64')).toBe(27.28)
    expect(plainValue({ toString: () => '[1,2]' }, 'List<Int32>')).toBe('[1,2]')
    expect(plainValue(null, 'Utf8')).toBeNull()
  })
})

describe('utf8Length', () => {
  it('counts as TextEncoder does', () => {
    for (const text of ['abc', 'São Paulo', 'Ação 📊', '\r\n']) {
      expect(utf8Length(text)).toBe(new TextEncoder().encode(text).length)
    }
  })
})
