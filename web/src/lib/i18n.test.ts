import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import pt from '../../messages/pt.json'
import { formatInteger, formatShare, localePath, t } from './i18n'

describe('messages', () => {
  it('has the same keys in Portuguese and English', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pt).sort())
  })

  it('has no empty message', () => {
    for (const messages of [pt, en]) {
      for (const [key, value] of Object.entries(messages)) {
        expect(value.trim(), key).not.toBe('')
      }
    }
  })

  it('uses the same placeholders in both languages', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const key of Object.keys(pt) as (keyof typeof pt)[]) {
      expect(placeholders(en[key]), key).toEqual(placeholders(pt[key]))
    }
  })

  it('fills placeholders', () => {
    expect(t('pt', 'area.electedCount', { count: '25' })).toBe('25 eleitos.')
    expect(t('en', 'area.electedCount', { count: '25' })).toBe('25 elected.')
  })
})

describe('number formats', () => {
  it('formats a share of 47.027% for each language', () => {
    expect(formatShare('pt', 47027, 100000)).toBe('47,03%')
    expect(formatShare('en', 47027, 100000)).toBe('47.03%')
  })

  it('formats counts with each language separator', () => {
    expect(formatInteger('pt', 119300788)).toBe('119.300.788')
    expect(formatInteger('en', 119300788)).toBe('119,300,788')
  })

  it('shows no share of nothing', () => {
    expect(formatShare('pt', 0, 0)).toBe('–')
  })
})

describe('localePath', () => {
  it('keeps Portuguese at the root and English under /en', () => {
    expect(localePath('pt', '/2026/pe/')).toBe('/2026/pe/')
    expect(localePath('en', '/2026/pe/')).toBe('/en/2026/pe/')
  })
})
