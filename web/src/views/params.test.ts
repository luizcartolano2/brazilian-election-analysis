import { beforeEach, describe, expect, it, vi } from 'vitest'

// Round 1 covers two states and abroad. Round 2 holds Acre's Governor runoff when pinned.
const state = { pinned: true }
vi.mock('@/lib/data', () => ({
  hasRound: (round: number) => round === 1 || state.pinned,
  coveredAreas: () => ['ac', 'pe', 'zz'],
}))
vi.mock('./area-views', () => ({
  raceSlugs: (area: string, round: number) =>
    round === 1
      ? ['presidente', 'governador', 'senador']
      : area === 'ac'
        ? ['presidente', 'governador']
        : ['presidente'],
}))

const { counterpartPath, pageRoundLinks, runoffAreaParams, runoffRaceParams } =
  await import('./params')

describe('counterpartPath', () => {
  beforeEach(() => {
    state.pinned = true
  })

  it('leads to the same area and race when the other round has that page', () => {
    expect(counterpartPath(2, 'ac', 'governador')).toBe('/2026/segundo-turno/ac/governador/')
    expect(counterpartPath(1, 'ac', 'governador')).toBe('/2026/ac/governador/')
  })

  it('falls back to the same area, then to the round’s Brazil page', () => {
    expect(counterpartPath(2, 'pe', 'senador')).toBe('/2026/segundo-turno/pe/')
    expect(counterpartPath(2, 'zz')).toBe('/2026/segundo-turno/zz/')
    expect(counterpartPath(2, 'rj', 'governador')).toBe('/2026/segundo-turno/')
    expect(counterpartPath(2)).toBe('/2026/segundo-turno/')
  })

  it('knows only the President race pages of round 2 before its pin', () => {
    state.pinned = false
    expect(counterpartPath(2, 'ac', 'governador')).toBe('/2026/segundo-turno/ac/')
    expect(runoffRaceParams()).toEqual([
      { uf: 'ac', cargo: 'presidente' },
      { uf: 'pe', cargo: 'presidente' },
    ])
    expect(runoffAreaParams()).toEqual([{ uf: 'ac' }, { uf: 'pe' }, { uf: 'zz' }])
  })

  it('marks the page’s own round in its links', () => {
    expect(pageRoundLinks(2, '/2026/segundo-turno/pe/', 'pe')).toEqual({
      current: 2,
      hrefs: { 1: '/2026/pe/', 2: '/2026/segundo-turno/pe/' },
    })
  })
})
