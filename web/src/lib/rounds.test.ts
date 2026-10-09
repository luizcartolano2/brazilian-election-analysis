import { describe, expect, it } from 'vitest'
import type { Summary, SummaryRace } from './results'
import { runoffMismatches } from './rounds'

function race(cargo: number, candidates: [number, string][]): SummaryRace {
  return {
    cargo,
    candidatos: candidates.map(([numero, resultado]) => ({
      numero,
      nome: `Candidate ${numero}`,
      partido: 'P',
      votos: 1,
      destino: 'Válido',
      resultado,
    })),
  } as SummaryRace
}

function version(areas: Record<string, SummaryRace[]>): Map<string, Summary> {
  return new Map(
    Object.entries(areas).map(([area, corridas]) => [
      area,
      { versao_esquema: 1, ano: 2026, turno: 1, area: area.toUpperCase(), corridas },
    ]),
  )
}

const FIRST = version({
  br: [
    race(1, [
      [13, '2º turno'],
      [22, '2º turno'],
      [70, 'Não eleito'],
    ]),
  ],
  rj: [
    race(1, [
      [13, '2º turno'],
      [22, '2º turno'],
      [70, 'Não eleito'],
    ]),
    race(3, [
      [10, '2º turno'],
      [40, '2º turno'],
      [55, 'Não eleito'],
    ]),
    race(5, [
      [111, 'Eleito'],
      [222, 'Eleito'],
      [333, 'Não eleito'],
    ]),
  ],
  sp: [
    race(1, [
      [13, '2º turno'],
      [22, '2º turno'],
    ]),
    race(3, [
      [15, 'Eleito'],
      [45, 'Não eleito'],
    ]),
  ],
})

describe('runoffMismatches', () => {
  it('accepts a round 2 that holds each runoff with its two finalists', () => {
    const second = version({
      br: [
        race(1, [
          [22, 'Eleito'],
          [13, 'Não eleito'],
        ]),
      ],
      rj: [
        race(1, [
          [13, 'Eleito'],
          [22, 'Não eleito'],
        ]),
        race(3, [
          [40, 'Eleito'],
          [10, 'Não eleito'],
        ]),
      ],
      sp: [
        race(1, [
          [13, 'Eleito'],
          [22, 'Não eleito'],
        ]),
      ],
    })
    expect(runoffMismatches(FIRST, second)).toEqual([])
  })

  it('names a round-2 race with a candidate that round 1 did not send', () => {
    const second = version({
      br: [
        race(1, [
          [22, 'Eleito'],
          [70, 'Não eleito'],
        ]),
      ],
      rj: [
        race(1, [
          [13, 'Eleito'],
          [22, 'Não eleito'],
        ]),
        race(3, [
          [40, 'Eleito'],
          [10, 'Não eleito'],
        ]),
      ],
      sp: [
        race(1, [
          [13, 'Eleito'],
          [22, 'Não eleito'],
        ]),
      ],
    })
    expect(runoffMismatches(FIRST, second)).toEqual([
      'round 2 holds 22 and 70 in br presidente, but round 1 sends 13 and 22',
    ])
  })

  it('names a cancelled Rio runoff while the pinned round 1 still sends it', () => {
    const second = version({
      br: [
        race(1, [
          [22, 'Eleito'],
          [13, 'Não eleito'],
        ]),
      ],
      rj: [
        race(1, [
          [13, 'Eleito'],
          [22, 'Não eleito'],
        ]),
      ],
      sp: [
        race(1, [
          [13, 'Eleito'],
          [22, 'Não eleito'],
        ]),
      ],
    })
    expect(runoffMismatches(FIRST, second)).toEqual([
      'round 1 sends rj governador to a runoff, which round 2 lacks',
    ])
  })

  it('names a round-2 race that round 1 decided, and an area that round 2 lacks', () => {
    const second = version({
      br: [
        race(1, [
          [22, 'Eleito'],
          [13, 'Não eleito'],
        ]),
      ],
      rj: [
        race(1, [
          [13, 'Eleito'],
          [22, 'Não eleito'],
        ]),
        race(3, [
          [40, 'Eleito'],
          [10, 'Não eleito'],
        ]),
      ],
      mg: [
        race(1, [
          [13, 'Eleito'],
          [22, 'Não eleito'],
        ]),
      ],
    })
    expect(runoffMismatches(FIRST, second)).toEqual([
      'round 2 holds mg presidente, which round 1 sends to no runoff',
      'round 1 sends sp presidente to a runoff, which round 2 lacks',
    ])
  })
})
