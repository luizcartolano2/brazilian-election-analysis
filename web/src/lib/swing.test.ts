import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import pt from '../../messages/pt.json'
import {
  compareSwing,
  sortRows,
  roundWithoutVotes,
  swingFill,
  swingMap,
  swingOf,
  swingOpponent,
  swingStep,
  swingStepRanges,
  type CandidateVotes,
  type SwingCase,
  type SwingRow,
} from './maps'
import { UNDER_APPEAL, VALID, type SummaryRace } from './results'

// Round 1 has a third candidate, 30, whose votes enter neither finalist's share.
const FIRST: CandidateVotes = {
  numbers: [13, 22, 30],
  rows: [
    [3550308, 71072, 'São Paulo', 10_000, 4_000, 3_000, 3_000],
    [2611606, 25313, 'Recife', 1_000, 600, 300, 100],
    [1100015, 310, 'Alta Floresta', 10, 0, 0, 10],
  ],
}
const SECOND: CandidateVotes = {
  numbers: [22, 13],
  rows: [
    [2611606, 25313, 'Recife', 950, 330, 620],
    [3550308, 71072, 'São Paulo', 9_500, 4_750, 4_750],
    [1100015, 310, 'Alta Floresta', 8, 3, 5],
  ],
}

function rowOf(data: { rows: SwingRow[] }, municipio: number): SwingRow {
  const row = data.rows.find((entry) => entry[1] === municipio)
  if (row === undefined) throw new Error(`no row ${municipio}`)
  return row
}

describe('swingMap', () => {
  it('joins both rounds on the TSE code, whatever their column and row order', () => {
    const data = swingMap(FIRST, SECOND, 13, 22, 'Lula')
    expect(data.kind).toBe('swing')
    expect(data.units).toEqual(['Lula'])
    expect(rowOf(data, 25313)).toEqual([2611606, 25313, 'Recife', 600, 300, 620, 330])
  })

  it('computes the change in the share of the two finalists’ votes', () => {
    const data = swingMap(FIRST, SECOND, 13, 22, 'Lula')
    // São Paulo: 4,000 of 7,000 in round 1, or 57.14%, then 4,750 of 9,500, or 50%.
    expect(swingOf(rowOf(data, 71072))).toBe(-7.1)
    // Recife: 600 of 900, then 620 of 950.
    expect(swingOf(rowOf(data, 25313))).toBe(-1.4)
  })

  it('gives the two finalists exact opposites, so their maps mirror', () => {
    const lula = swingMap(FIRST, SECOND, 13, 22, 'Lula')
    const flavio = swingMap(FIRST, SECOND, 22, 13, 'Flávio')
    for (const row of lula.rows) {
      const own = swingOf(row)
      const mirrored = swingOf(rowOf(flavio, row[1]))
      expect(mirrored === null ? null : -mirrored).toBe(own === null ? null : own)
      if (own !== null && mirrored !== null) expect(swingStep(mirrored)).toBe(-swingStep(own))
    }
  })

  it('gives no swing where the finalists had no votes in a round', () => {
    const data = swingMap(FIRST, SECOND, 13, 22, 'Lula')
    const row = rowOf(data, 310)
    expect(swingOf(row)).toBeNull()
    expect(roundWithoutVotes(row)).toBe(1)
    expect(swingFill(row)).toEqual({ kind: 'noSwing' })
  })

  it('throws on a municipality that one file lacks', () => {
    const shorter: CandidateVotes = { ...SECOND, rows: SECOND.rows.slice(0, 2) }
    expect(() => swingMap(FIRST, shorter, 13, 22, 'Lula')).toThrow(
      /round 2 has no municipality 310/,
    )
    const longer: CandidateVotes = {
      ...SECOND,
      rows: [...SECOND.rows, [1200013, 1007, 'Acrelândia', 1, 1, 0]],
    }
    expect(() => swingMap(FIRST, longer, 13, 22, 'Lula')).toThrow(
      /round 1 has no municipality 1007/,
    )
  })

  it('throws on a file with no column for a finalist', () => {
    expect(() => swingMap(FIRST, SECOND, 13, 30, 'Lula')).toThrow(/round 2 has no column for 30/)
  })
})

describe('swingOf', () => {
  it('rounds a half away from zero on both sides', () => {
    // 1 of 2, then 21 of 40: a change of +2.5 points, and -2.5 for the other finalist.
    expect(swingOf([1, 1, 'A', 1, 1, 21, 19])).toBe(2.5)
    expect(swingOf([1, 1, 'A', 1, 1, 19, 21])).toBe(-2.5)
    // 1 of 2, then 201 of 400: +0.25, which rounds to +0.3 and -0.3.
    expect(swingOf([1, 1, 'A', 1, 1, 201, 199])).toBe(0.3)
    expect(swingOf([1, 1, 'A', 1, 1, 199, 201])).toBe(-0.3)
  })

  it('rounds exactly where a large city’s products pass 2^53', () => {
    // 8,004,161 of 8,602,000 is exactly 93.05%, after 0 of 9,046,897 in round 1.
    expect(swingOf([1, 1, 'A', 0, 9_046_897, 8_004_161, 597_839])).toBe(93.1)
    expect(swingOf([1, 1, 'A', 9_046_897, 0, 597_839, 8_004_161])).toBe(-93.1)
  })

  it('never returns a negative zero', () => {
    expect(Object.is(swingOf([1, 1, 'A', 1, 1, 1999, 2001]), 0)).toBe(true)
  })
})

describe('sortRows', () => {
  const collator = new Intl.Collator('pt-BR')
  const rows: SwingRow[] = [
    [1, 1, 'Recife', 6, 4, 50, 50],
    [2, 2, 'Alta Floresta', 0, 0, 1, 1],
    [3, 3, 'Olinda', 4, 6, 50, 50],
    [4, 4, 'Caruaru', 4, 6, 50, 50],
    [5, 5, 'Bezerros', 1, 1, 2, 2],
  ]

  it('orders by name, ignoring case and accents as Portuguese does', () => {
    expect(sortRows(rows, 'name', collator).map((row) => row[2])).toEqual([
      'Alta Floresta',
      'Bezerros',
      'Caruaru',
      'Olinda',
      'Recife',
    ])
  })

  it('orders by swing from the largest gain, ties by name, and no swing last', () => {
    expect(sortRows(rows, 'swing', collator).map((row) => row[2])).toEqual([
      'Caruaru',
      'Olinda',
      'Bezerros',
      'Recife',
      'Alta Floresta',
    ])
  })

  it('leaves the rows it was given in their order', () => {
    const before = rows.map((row) => row[2])
    sortRows(rows, 'swing', collator)
    expect(rows.map((row) => row[2])).toEqual(before)
  })
})

describe('compareSwing', () => {
  it('orders from the largest gain to the largest loss, with no swing last', () => {
    const rows: SwingRow[] = [
      [1, 1, 'Loss', 6, 4, 50, 50],
      [2, 2, 'None', 0, 0, 1, 1],
      [3, 3, 'Gain', 4, 6, 50, 50],
      [4, 4, 'Same', 1, 1, 2, 2],
    ]
    expect(rows.sort(compareSwing).map((row) => row[2])).toEqual(['Gain', 'Same', 'Loss', 'None'])
  })
})

function race(numbers: [number, string][]): SummaryRace {
  return {
    eleicao: 6258,
    cargo: 1,
    nome: 'Presidente',
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
    candidatos: numbers.map(([numero, destino]) => ({
      numero,
      nome: String(numero),
      partido: 'P',
      votos: 1,
      destino,
      resultado: '',
    })),
    partidos: [],
  }
}

describe('swingOpponent', () => {
  const real: SwingCase = {
    numero: 13,
    mapped: true,
    synthetic: false,
    syntheticAllowed: false,
    comparable: true,
    first: race([
      [13, VALID],
      [22, VALID],
      [30, VALID],
    ]),
    second: race([
      [22, VALID],
      [13, VALID],
    ]),
    votes: () => [FIRST, SECOND],
  }

  it('names the other finalist on real data from both rounds', () => {
    expect(swingOpponent(real)).toBe(22)
    expect(swingOpponent({ ...real, numero: 22 })).toBe(13)
  })

  it('shows no swing on a synthetic round, unless a fixtures build allows it', () => {
    expect(swingOpponent({ ...real, synthetic: true })).toBeNull()
    expect(swingOpponent({ ...real, synthetic: true, syntheticAllowed: true })).toBe(22)
  })

  it('shows no swing when a finalist’s round-2 votes are under appeal', () => {
    const second = race([
      [22, UNDER_APPEAL],
      [13, VALID],
    ])
    expect(swingOpponent({ ...real, second })).toBeNull()
    expect(swingOpponent({ ...real, numero: 22, second })).toBeNull()
  })

  it('shows no swing when the two rounds list different municipalities', () => {
    expect(swingOpponent({ ...real, comparable: false })).toBeNull()
  })

  it('shows no swing in an area with one municipality, and reads no votes file there', () => {
    const votes = () => {
      throw new Error('read a votes file')
    }
    expect(swingOpponent({ ...real, mapped: false, votes })).toBeNull()
  })

  it('shows no swing for a candidate who was not a finalist', () => {
    expect(swingOpponent({ ...real, numero: 30 })).toBeNull()
  })
})

describe('the swing messages', () => {
  // The messages that the swing section shows besides its own: its list, its failures and credits.
  const SHARED = [
    'map.listSummary',
    'map.listLoading',
    'map.loading',
    'map.failed',
    'map.noScriptList',
    'map.valuesFailed',
    'map.retry',
    'map.siteUpdated',
    'map.reload',
    'map.view',
    'map.close',
    'map.water',
    'map.municipality',
    'map.filter',
    'map.sortName',
    'map.count',
    'footer.credit',
    'sources.boundariesCredit',
  ]
  const sectionEntries = (messages: Record<string, string>) =>
    Object.entries(messages).filter(([key]) => key.startsWith('map.swing') || SHARED.includes(key))

  it('never say that a vote went from one candidate to another, in either language', () => {
    const forbidden =
      /transf|migra|eleitor(es)? d[eao]|voters of|['’]s voters|herd|inherit|vieram de|came from/i
    for (const messages of [pt, en]) {
      const entries = sectionEntries(messages)
      expect(entries.length).toBe(
        Object.keys(messages).filter((key) => key.startsWith('map.swing')).length + SHARED.length,
      )
      for (const [key, value] of entries) expect(value, key).not.toMatch(forbidden)
    }
  })

  it('name the two finalists’ votes in every label of a share', () => {
    for (const [messages, denominator] of [
      [pt, 'dos votos dos dois finalistas'],
      [en, 'of the two finalists'],
    ] as const) {
      for (const key of [
        'map.swingFirstShare',
        'map.swingSecondShare',
        'map.swingHeadFirst',
        'map.swingHeadSecond',
      ]) {
        expect(messages[key as keyof typeof messages], key).toContain(denominator)
      }
    }
  })
})

describe('swingStepRanges', () => {
  it('names the rounded swings of each step, with no value in two steps', () => {
    expect(swingStepRanges()).toEqual([
      [null, -6],
      [-5.9, -3],
      [-2.9, -1],
      [-0.9, 0.9],
      [1, 2.9],
      [3, 5.9],
      [6, null],
    ])
  })

  it('agrees with the step that colors each endpoint, and with the next step a tenth beyond', () => {
    swingStepRanges().forEach(([low, high], index) => {
      const step = index - 3
      if (low !== null) {
        expect(swingStep(low), String(low)).toBe(step)
        expect(swingStep(Math.round(low * 10 - 1) / 10), String(low)).toBe(step - 1)
      }
      if (high !== null) {
        expect(swingStep(high), String(high)).toBe(step)
        expect(swingStep(Math.round(high * 10 + 1) / 10), String(high)).toBe(step + 1)
      }
    })
  })
})
