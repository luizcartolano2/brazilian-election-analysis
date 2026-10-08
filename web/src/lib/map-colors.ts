/** The maps' colors: two hues for the two most voted, each in three shades, and neutrals. */
import type { Fill } from './maps'

// ColorBrewer's blues and oranges, a pair that stays apart for the common color-vision deficiencies.
type Shades = readonly [string, string, string]

export const SHADES: readonly [Shades, Shades] = [
  ['#c6dbef', '#6baed6', '#08519c'],
  ['#fdd0a2', '#f16913', '#a63603'],
]
export const SENATE_SHADE = [SHADES[0][1], SHADES[1][1]] as const
// ColorBrewer's greens, a hue apart from the two candidate colors, for a share's six steps.
export const SHARE_SHADES = ['#edf8e9', '#c7e9c0', '#a1d99b', '#74c476', '#31a354', '#006d2c']
export const OTHER = '#bdbdbd'
export const NO_VOTES = '#f1f5f9'
export const WATER = '#dbeafe'
export const TIE_PATTERN = 'map-tie'

/**
 * A candidate's mark outside a map: the darkest shade of its map color, or the Senate map's
 * single shade, or the others' gray.
 */
export function candidateColor(rank: 0 | 1 | undefined, senate = false): string {
  if (rank === undefined) return OTHER
  return senate ? SENATE_SHADE[rank] : SHADES[rank][2]
}

export function fillColor(fill: Fill, patternId: string): string {
  switch (fill.kind) {
    case 'leader':
      return fill.bin === null ? SENATE_SHADE[fill.color] : SHADES[fill.color][fill.bin]
    case 'share':
      return SHARE_SHADES[fill.step] ?? OTHER
    case 'tie':
      return `url(#${patternId})`
    case 'other':
      return OTHER
    case 'none':
      return NO_VOTES
  }
}
