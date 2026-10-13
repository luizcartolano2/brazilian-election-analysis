import { describe, expect, it } from 'vitest'
import { formatBytes, formatCell } from './display'

describe('formatCell', () => {
  it('prints counts with the visitor separators, and codes without them', () => {
    expect(formatCell('pt', 56423n, 'votos')).toBe('56.423')
    expect(formatCell('pt', 27.28, 'percentual_validos')).toBe('27,28')
    expect(formatCell('pt', 4033, 'numero')).toBe('4033')
    expect(formatCell('pt', 25313, 'municipio')).toBe('25313')
    expect(formatCell('en', 2611606, 'IBGE')).toBe('2611606')
    expect(formatCell('pt', null, 'votos')).toBe('')
  })
})

describe('formatBytes', () => {
  it('prints sizes in B, kB and MB', () => {
    expect(formatBytes('pt', 870)).toBe('870 B')
    expect(formatBytes('pt', 1703)).toBe('1,7 kB')
    expect(formatBytes('en', 4_920_000)).toBe('4.9 MB')
  })
})
