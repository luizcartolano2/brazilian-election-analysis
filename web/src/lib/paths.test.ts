import { expect, it } from 'vitest'
import { roundPath } from './paths'

it('moves a round-1 address under the runoff slug for round 2 only', () => {
  expect(roundPath(1, '/2026/pe/')).toBe('/2026/pe/')
  expect(roundPath(2, '/2026/')).toBe('/2026/segundo-turno/')
  expect(roundPath(2, '/2026/secao/')).toBe('/2026/segundo-turno/secao/')
})
