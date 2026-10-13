import { describe, expect, it } from 'vitest'
import {
  fillColor,
  NO_SWING_HATCH,
  noSwingPattern,
  SENATE_SHADE,
  SHADES,
  SWING_SHADES,
} from './map-colors'
import { swingStep } from './maps'

describe('swing steps', () => {
  it('cuts the absolute value at 1, 3 and 6 points, each edge in the step above it', () => {
    const cases: [number, number][] = [
      [0, 0],
      [0.9, 0],
      [1, 1],
      [2.9, 1],
      [3, 2],
      [5.9, 2],
      [6, 3],
      [42.1, 3],
    ]
    for (const [swing, step] of cases) {
      expect(swingStep(swing), String(swing)).toBe(step)
      expect(swingStep(-swing), String(-swing)).toBe(step === 0 ? 0 : -step)
    }
  })

  it('puts +1.0 and -1.0 in mirrored steps around the gray middle', () => {
    const gain = SWING_SHADES[swingStep(1) + 3]
    const loss = SWING_SHADES[swingStep(-1) + 3]
    expect(SWING_SHADES.indexOf(gain ?? '') + SWING_SHADES.indexOf(loss ?? '')).toBe(6)
    expect(gain).not.toBe(SWING_SHADES[3])
  })

  it('draws every step in a color that no candidate uses', () => {
    const candidates = new Set<string>([...SHADES.flat(), ...SENATE_SHADE])
    expect(SWING_SHADES).toHaveLength(7)
    for (const shade of SWING_SHADES) expect(candidates.has(shade), shade).toBe(false)
  })

  it('hatches a municipality with no swing, apart from every step', () => {
    expect(fillColor({ kind: 'noSwing' }, 'p1')).toBe(`url(#${noSwingPattern('p1')})`)
    for (let step = -3; step <= 3; step += 1) {
      const color = fillColor({ kind: 'swing', step }, 'p1')
      expect(color).toBe(SWING_SHADES[step + 3])
      expect(color).not.toBe(NO_SWING_HATCH.background)
      expect(color).not.toBe(NO_SWING_HATCH.line)
    }
  })
})
