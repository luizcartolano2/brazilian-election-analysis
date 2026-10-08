import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { OTHER, SHADES } from './map-colors'

const css = readFileSync(path.join(import.meta.dirname, '..', '..', 'app', 'globals.css'), 'utf-8')
const tokens = Object.fromEntries(
  [...css.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((match) => [match[1], match[2]]),
)

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
  const [red, green, blue] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number]
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [
    number,
    number,
  ]
  return (light + 0.05) / (dark + 0.05)
}

const WHITE = '#ffffff'

describe('the design tokens', () => {
  it('declares the four neutrals', () => {
    expect(Object.keys(tokens).sort()).toEqual(['ink', 'line', 'muted', 'surface'])
  })

  it.each([
    ['ink', 'white'],
    ['muted', 'white'],
    ['ink', 'surface'],
    ['muted', 'surface'],
  ])('%s text on %s reaches 4.5 to 1', (text, background) => {
    const back = background === 'white' ? WHITE : (tokens[background] as string)
    expect(contrast(tokens[text] as string, back)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps 4.5 to 1 for the text on every map color', () => {
    const ink = tokens.ink as string
    for (const shades of SHADES) {
      expect(contrast(WHITE, shades[2])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(ink, shades[0])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(ink, shades[1])).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(ink, OTHER)).toBeGreaterThanOrEqual(4.5)
  })
})
