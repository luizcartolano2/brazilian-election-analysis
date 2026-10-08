/** The maps' colors: two hues for the two most voted, each in three shades, and neutrals. */
import type { Fill } from './maps'

// ColorBrewer's blues and oranges, a pair that stays apart for the common color-vision deficiencies.
type Shades = readonly [string, string, string]

export const SHADES: readonly [Shades, Shades] = [
  ['#c6dbef', '#6baed6', '#08519c'],
  ['#fdd0a2', '#f16913', '#a63603'],
]
export const SENATE_SHADE = [SHADES[0][1], SHADES[1][1]] as const
export const OTHER = '#bdbdbd'
export const NO_VOTES = '#f1f5f9'
export const WATER = '#dbeafe'
export const TIE_PATTERN = 'map-tie'

export function fillColor(fill: Fill, patternId: string): string {
  switch (fill.kind) {
    case 'leader':
      return fill.bin === null ? SENATE_SHADE[fill.color] : SHADES[fill.color][fill.bin]
    case 'tie':
      return `url(#${patternId})`
    case 'other':
      return OTHER
    case 'none':
      return NO_VOTES
  }
}
