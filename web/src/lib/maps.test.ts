import { describe, expect, it } from 'vitest'
import {
  CANDIDATE,
  checkRaceSums,
  isMappedArea,
  federationLabel,
  fillOf,
  mapRows,
  PARTY_LIST,
  raceUnits,
  shareMap,
  stepOf,
  type MapRow,
  type VoteTotal,
} from './maps'
import { UNDER_APPEAL, VALID, VALID_LIST, type SummaryRace } from './results'

function race(overrides: Partial<SummaryRace>): SummaryRace {
  return {
    eleicao: 6259,
    cargo: 3,
    nome: 'Governador',
    vagas: 1,
    escolhas_por_eleitor: 1,
    aptos: 0,
    comparecimento: 0,
    abstencoes: 0,
    validos: 0,
    nominais: 0,
    legenda: 0,
    brancos: 0,
    nulos: 0,
    nulos_tecnicos: 0,
    anulados: 0,
    anulados_sub_judice: 0,
    candidatos: [],
    ...overrides,
  }
}

function candidate(numero: number, nome: string, partido: string, votos: number, destino = VALID) {
  return { numero, nome, partido, votos, destino, resultado: '' }
}

function party(numero: number, sigla: string, votos_legenda: number, destino = VALID_LIST) {
  return { numero, sigla, votos_legenda, votos_candidatos: 0, destino }
}

const GOVERNOR = race({
  validos: 1000,
  candidatos: [
    candidate(40, 'ANA', 'PSB', 520),
    candidate(55, 'BETO', 'PSD', 400),
    candidate(50, 'CAIO', 'PSOL', 80),
  ],
})

// Candidate 13123 carries PT's digits, but the summary puts them in PL.
const DEPUTIES = race({
  cargo: 6,
  vagas: 25,
  validos: 1010,
  candidatos: [
    candidate(13123, 'DIGITS SAY PT', 'PL', 300),
    candidate(13001, 'REAL PT', 'PT', 200),
    candidate(43001, 'GREEN', 'PV', 150),
    candidate(50001, 'LEFT', 'PSOL', 250),
    candidate(22999, 'UNDER APPEAL', 'PL', 70, UNDER_APPEAL),
  ],
  partidos: [
    party(22, 'PL', 40),
    party(13, 'PT', 60),
    party(43, 'PV', 10),
    party(50, 'PSOL', 50, UNDER_APPEAL),
  ],
})

const FEDERATIONS = new Map([
  ['PT', 'FEDERAÇÃO BRASIL DA ESPERANÇA - FE BRASIL'],
  ['PV', 'FEDERAÇÃO BRASIL DA ESPERANÇA - FE BRASIL'],
])

describe('isMappedArea', () => {
  it('maps a state with more than one municipality, and neither the Federal District nor abroad', () => {
    expect(isMappedArea('pe', 185)).toBe(true)
    expect(isMappedArea('df', 1)).toBe(false)
    expect(isMappedArea('zz', 186)).toBe(false)
  })
})

describe('federationLabel', () => {
  it('takes the short form after " - ", or drops the word FEDERAÇÃO', () => {
    expect(federationLabel('FEDERAÇÃO BRASIL DA ESPERANÇA - FE BRASIL')).toBe('FE BRASIL')
    expect(federationLabel('FEDERAÇÃO PSDB CIDADANIA')).toBe('PSDB CIDADANIA')
  })
})

describe('raceUnits', () => {
  it('ranks the candidates of a majoritarian race by their votes in the area', () => {
    const units = raceUnits(GOVERNOR, false, new Map())

    expect(units.kind).toBe('margin')
    expect(units.units).toEqual(['ANA (PSB)', 'BETO (PSD)', 'CAIO (PSOL)'])
    expect(units.mapping).toContainEqual([CANDIDATE, 55, 1])
  })

  it('takes a deputy candidate party from the summary, not from the digits', () => {
    const units = raceUnits(DEPUTIES, true, FEDERATIONS)
    const unitOf = (tipo: number, numero: number) => {
      const entry = units.mapping.find(([kind, number]) => kind === tipo && number === numero)
      return entry === undefined ? undefined : units.units[entry[2]]
    }

    expect(unitOf(CANDIDATE, 13123)).toBe('PL')
    expect(unitOf(CANDIDATE, 13001)).toBe('FE BRASIL')
  })

  it('sums a federation over its parties, candidates and lists, and leaves votes under appeal out', () => {
    const units = raceUnits(DEPUTIES, true, FEDERATIONS)

    // FE BRASIL: 200 + 150 + 60 + 10. PL: 300 + 40. PSOL: 250, its list is under appeal.
    expect(units.units).toEqual(['FE BRASIL', 'PL', 'PSOL'])
    expect(units.mapping.some(([, number]) => number === 22999)).toBe(false)
    expect(units.mapping.some(([kind, number]) => kind === PARTY_LIST && number === 50)).toBe(false)
  })

  it('ranks President by Brazil, so a state map keeps Brazil top two', () => {
    const brazil = race({
      cargo: 1,
      candidatos: [candidate(22, 'FIRST', 'PL', 900), candidate(13, 'SECOND', 'PT', 800)].concat(
        candidate(30, 'THIRD', 'NOVO', 100),
      ),
    })
    const state = race({
      cargo: 1,
      candidatos: [
        candidate(22, 'FIRST', 'PL', 50),
        candidate(30, 'THIRD', 'NOVO', 40),
        candidate(13, 'SECOND', 'PT', 10),
      ],
    })

    expect(raceUnits(state, false, new Map(), brazil).units.slice(0, 2)).toEqual([
      'FIRST (PL)',
      'SECOND (PT)',
    ])
  })

  it('makes a Senate race a map with one shade', () => {
    const senate = race({ cargo: 5, vagas: 2, escolhas_por_eleitor: 2 })

    expect(raceUnits(senate, false, new Map()).kind).toBe('senate')
  })
})

describe('checkRaceSums', () => {
  const totals = (overrides: Record<number, number> = {}): VoteTotal[] => [
    { tipo: CANDIDATE, numero: 40, votos: overrides[40] ?? 520 },
    { tipo: CANDIDATE, numero: 55, votos: overrides[55] ?? 400 },
    { tipo: CANDIDATE, numero: 50, votos: overrides[50] ?? 80 },
  ]

  it('passes municipalities that add up to the summary', () => {
    expect(checkRaceSums('pe governador', GOVERNOR, false, totals())).toEqual([])
  })

  it('names the candidate, the area and both numbers on a one-vote difference', () => {
    expect(checkRaceSums('pe governador', GOVERNOR, false, totals({ 55: 401 }))).toEqual([
      'pe governador: candidate 55 BETO: 400 votes in the summary, 401 in its municipalities',
      'pe governador: the valid votes: 1000 votes in the summary, 1001 in its municipalities',
    ])
  })

  it('reports every difference', () => {
    expect(
      checkRaceSums('pe governador', GOVERNOR, false, totals({ 40: 519, 50: 79 })),
    ).toHaveLength(3)
  })

  it('checks a deputy party on valid candidate votes and valid list votes, with appeals on neither side', () => {
    const deputyTotals: VoteTotal[] = [
      { tipo: CANDIDATE, numero: 13123, votos: 300 },
      { tipo: CANDIDATE, numero: 13001, votos: 200 },
      { tipo: CANDIDATE, numero: 43001, votos: 150 },
      { tipo: CANDIDATE, numero: 50001, votos: 250 },
      { tipo: 7, numero: 22999, votos: 70 },
      { tipo: PARTY_LIST, numero: 22, votos: 40 },
      { tipo: PARTY_LIST, numero: 13, votos: 60 },
      { tipo: PARTY_LIST, numero: 43, votos: 10 },
      { tipo: 7, numero: 50, votos: 50 },
    ]

    expect(checkRaceSums('sp deputado-federal', DEPUTIES, true, deputyTotals)).toEqual([])
  })

  it('passes the Brazil check only with the cities abroad', () => {
    const brazil = race({
      cargo: 1,
      validos: 110,
      candidatos: [candidate(22, 'FIRST', 'PL', 60), candidate(13, 'SECOND', 'PT', 50)],
    })
    const states: VoteTotal[] = [
      { tipo: CANDIDATE, numero: 22, votos: 55 },
      { tipo: CANDIDATE, numero: 13, votos: 48 },
    ]
    const abroad: VoteTotal[] = [
      { tipo: CANDIDATE, numero: 22, votos: 5 },
      { tipo: CANDIDATE, numero: 13, votos: 2 },
    ]

    expect(checkRaceSums('br presidente', brazil, false, states)).not.toEqual([])
    expect(checkRaceSums('br presidente', brazil, false, [...states, ...abroad])).toEqual([])
  })
})

describe('mapRows and fillOf', () => {
  const municipalities = [
    { municipio: 1, ibge: 2600001, nome: 'CLOSE' },
    { municipio: 2, ibge: 2600002, nome: 'TIED' },
    { municipio: 3, ibge: 2600003, nome: 'MINOR' },
    { municipio: 4, ibge: 2600004, nome: 'EMPTY' },
  ]
  const rows = mapRows(
    municipalities,
    [
      { municipio: 1, unit: 0, votos: 516 },
      { municipio: 1, unit: 1, votos: 484 },
      { municipio: 2, unit: 0, votos: 300 },
      { municipio: 2, unit: 1, votos: 300 },
      { municipio: 3, unit: 2, votos: 500 },
      { municipio: 3, unit: 0, votos: 400 },
    ],
    new Map([
      [1, 1000],
      [2, 600],
      [3, 900],
    ]),
  )
  const row = (name: string) => rows.find((entry) => entry[2] === name) as MapRow

  it('shades a 3.2-point lead in the lightest shade of the leader', () => {
    expect(fillOf(row('CLOSE'), 'margin')).toEqual({ kind: 'leader', color: 0, bin: 0 })
  })

  it('gives a tie its own style', () => {
    expect(fillOf(row('TIED'), 'margin')).toEqual({ kind: 'tie' })
  })

  it('grays a municipality led by a candidate outside the top two', () => {
    expect(fillOf(row('MINOR'), 'margin')).toEqual({ kind: 'other' })
  })

  it('leaves a municipality with no votes unfilled', () => {
    expect(fillOf(row('EMPTY'), 'margin')).toEqual({ kind: 'none' })
  })

  it('gives a Senate leader one shade with no bin', () => {
    expect(fillOf(row('CLOSE'), 'senate')).toEqual({ kind: 'leader', color: 0, bin: null })
  })

  it('shades by bins that cut at 5 and 20 points', () => {
    const at = (first: number, second: number): MapRow => [1, 1, 'X', 1, first, 0, second, 100]

    expect(fillOf(at(52, 48), 'margin')).toMatchObject({ bin: 0 })
    expect(fillOf(at(53, 48), 'margin')).toMatchObject({ bin: 1 })
    expect(fillOf(at(60, 40), 'margin')).toMatchObject({ bin: 2 })
  })
})

describe('shareMap and stepOf', () => {
  const votes = {
    numbers: [13, 22],
    rows: [
      [2611606, 25313, 'RECIFE', 1000, 450, 550],
      [2605459, 30015, 'NORONHA', 0, 0, 0],
    ] as [number, number, string, number, ...number[]][],
  }

  it('takes one candidate column, with the valid votes', () => {
    const map = shareMap(votes, 22, 'SECOND (PL)', 10)

    expect(map?.kind).toBe('share')
    expect(map?.units).toEqual(['SECOND (PL)'])
    expect(map?.rows[0]).toEqual([2611606, 25313, 'RECIFE', 0, 550, -1, 0, 1000])
    expect(shareMap(votes, 99, 'NOBODY', 10)).toBeNull()
  })

  it('cuts President and Governor shares in steps of 10, and the Senate in steps of 5', () => {
    const at = (share: number): MapRow => [1, 1, 'X', 0, share, -1, 0, 100]

    expect([0, 9, 10, 49, 50, 97].map((share) => stepOf(at(share), 10))).toEqual([0, 0, 1, 4, 5, 5])
    expect([4, 5, 24, 25, 60].map((share) => stepOf(at(share), 5))).toEqual([0, 1, 4, 5, 5])
  })

  it('leaves a municipality with no valid votes unfilled', () => {
    const map = shareMap(votes, 13, 'FIRST (PT)', 10)

    expect(fillOf(map?.rows[1] as MapRow, 'share', 10)).toEqual({ kind: 'none' })
    expect(fillOf(map?.rows[0] as MapRow, 'share', 10)).toEqual({ kind: 'share', step: 4 })
  })
})
