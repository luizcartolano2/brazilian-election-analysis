import { describe, expect, it } from 'vitest'
import { linkFragment, MAX_QUERY_LENGTH, readLink, type LinkState } from './link'

const PINNED = { 1: '20261007-67d59ff-37656362427' } as const
const STATE: LinkState = {
  versions: { 1: PINNED[1] },
  choice: { rounds: [1], races: [1, 3], areas: ['ac', 'pe'] },
  sql: "SELECT 'São Paulo' AS nome, 1 AS n -- até logo",
}

function encodePayload(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `#c=${btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`
}

function payload(changes: Record<string, unknown>) {
  return encodePayload({
    v: 1,
    versoes: { 1: PINNED[1] },
    turnos: [1],
    cargos: [1],
    areas: ['ac'],
    sql: 'SELECT 1',
    ...changes,
  })
}

describe('the link', () => {
  it('round-trips its state, accents included', () => {
    const fragment = linkFragment(STATE)
    expect(fragment).toMatch(/^#c=[A-Za-z0-9_-]+$/)
    expect(readLink(fragment, PINNED)).toEqual({ status: 'valid', state: STATE, stale: [] })
  })

  it('reads an address with no link as no link', () => {
    expect(readLink('', PINNED)).toEqual({ status: 'none' })
    expect(readLink('#senador', PINNED)).toEqual({ status: 'none' })
  })

  it.each([
    ['a state code with a slash', payload({ areas: ['p/e'] })],
    ['a path in the state code', payload({ areas: ['../x'] })],
    ['SQL in the state code', payload({ areas: ["ac'; DROP TABLE x; --"] })],
    ['Brazil with a state', payload({ areas: ['br', 'ac'] })],
    ['a race the election lacks', payload({ cargos: [99] })],
    ['a race as text', payload({ cargos: ['1'] })],
    ['a round that is not pinned', payload({ turnos: [2], versoes: { 2: 'x' } })],
    ['no round', payload({ turnos: [] })],
    ['a query too long', payload({ sql: 'x'.repeat(MAX_QUERY_LENGTH + 1) })],
    ['a version with odd characters', payload({ versoes: { 1: '../../x' } })],
    ['another format', payload({ v: 2 })],
    ['text that is not URL-safe base64', '#c=$$$'],
    ['base64 that is not JSON', `#c=${btoa('not json')}`],
  ])('refuses %s', (_, fragment) => {
    expect(readLink(fragment, PINNED)).toEqual({ status: 'invalid' })
  })

  it('names both versions when the link names an earlier one', () => {
    const reading = readLink(payload({ versoes: { 1: '20261001-aaaaaaa-1' } }), PINNED)
    expect(reading.status).toBe('valid')
    expect(reading.status === 'valid' && reading.stale).toEqual([
      { round: 1, linked: '20261001-aaaaaaa-1', pinned: PINNED[1] },
    ])
  })
})
