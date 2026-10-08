import { describe, expect, it } from 'vitest'
import {
  CANDIDACY_FIELDS,
  candidateRowId,
  hitHref,
  MAX_RESULTS,
  MUNICIPALITY_FIELDS,
  normalize,
  prepareIndex,
  search,
  type CandidacyEntry,
  type MunicipalityEntry,
} from './search'

const MUNICIPALITIES: MunicipalityEntry[] = [
  ['SÃO JOSÉ', 'sc', 81574, false],
  ['SÃO JOSÉ DOS CAMPOS', 'sp', 70211, false],
  ['SÃO JOSÉ DE RIBAMAR', 'ma', 9512, false],
  ['SÃO PAULO', 'sp', 71072, true],
  ['JOSÉ BOITEUX', 'sc', 80470, false],
  ['RECIFE', 'pe', 25313, true],
  ['LISBOA', 'zz', 29505, false],
  ["SANTA BÁRBARA D'OESTE", 'sp', 64432, false],
]

const CANDIDACIES: CandidacyEntry[] = [
  ['LULA', 13, 'PT', 1, 'br', '2º turno', 53_879_538],
  ['HUMBERTO COSTA', 130, 'PT', 5, 'pe', 'Não eleito', 1_200_000],
  ['ABIMAEL SANTOS', 22622, 'PL', 7, 'pe', 'Eleito por QP', 80_000],
  ['ZÉ DO RECIFE', 4040, 'MDB', 6, 'pe', 'Suplente', 12_000],
  ['RECIFENSE', 5050, 'PSB', 6, 'pe', 'Não eleito', 30_000],
  ['ANA 100%', 1100, 'PSOL', 6, 'sp', 'Não eleito', 900],
  ['ZÉ "DO POVO"', 1200, 'PV', 6, 'sp', 'Não eleito', 800],
]

function index(extra: CandidacyEntry[] = []) {
  return prepareIndex(
    { campos: MUNICIPALITY_FIELDS, linhas: MUNICIPALITIES },
    { campos: CANDIDACY_FIELDS, linhas: [...CANDIDACIES, ...extra] },
  )
}

function names(text: string, extra: CandidacyEntry[] = []): string[] {
  return search(index(extra), text).hits.map((hit) => hit.name)
}

describe('normalize', () => {
  it('drops case, accents and repeated spaces', () => {
    expect(normalize('  São   JOSÉ ')).toBe('sao jose')
  })
})

describe('search', () => {
  it('finds every municipality that holds "São José" without accents', () => {
    const hits = search(index(), 'sao jose').hits
    const municipalities = hits.filter((hit) => hit.kind === 'municipality')
    expect(municipalities.map((hit) => [hit.name, hit.area])).toEqual([
      ['SÃO JOSÉ', 'sc'],
      ['SÃO JOSÉ DE RIBAMAR', 'ma'],
      ['SÃO JOSÉ DOS CAMPOS', 'sp'],
    ])
  })

  it('finds a city abroad under its Portuguese name', () => {
    expect(search(index(), 'lisboa').hits).toEqual([
      { kind: 'municipality', name: 'LISBOA', area: 'zz', municipality: 29505, capital: false },
    ])
  })

  it('finds a candidacy by its full ballot number', () => {
    expect(names('22622')).toEqual(['ABIMAEL SANTOS'])
  })

  it('does not match a partial ballot number', () => {
    expect(names('2262')).toEqual([])
  })

  it('treats quotes, %, _ and * as plain characters', () => {
    expect(names("d'oeste")).toEqual(["SANTA BÁRBARA D'OESTE"])
    expect(names('100%')).toEqual(['ANA 100%'])
    expect(names('"do')).toEqual(['ZÉ "DO POVO"'])
    expect(names('a_a')).toEqual([])
    expect(names('a*')).toEqual([])
    expect(names('a%')).toEqual([])
  })

  it('needs every typed word, in any order', () => {
    expect(names('campos jose')).toEqual(['SÃO JOSÉ DOS CAMPOS'])
  })

  it('ranks names that start with the query, then a word, then the rest', () => {
    expect(names('recife')).toEqual(['RECIFE', 'RECIFENSE', 'ZÉ DO RECIFE'])
    expect(names('jose')).toEqual([
      'JOSÉ BOITEUX',
      'SÃO JOSÉ',
      'SÃO JOSÉ DE RIBAMAR',
      'SÃO JOSÉ DOS CAMPOS',
    ])
  })

  it('puts capitals before other municipalities, and candidacies by votes', () => {
    expect(names('sao')).toEqual([
      'SÃO PAULO',
      'SÃO JOSÉ',
      'SÃO JOSÉ DE RIBAMAR',
      'SÃO JOSÉ DOS CAMPOS',
    ])
    const extra: CandidacyEntry[] = [
      ['LULA DA SILVA', 77777, 'PV', 6, 'ba', 'Não eleito', 10],
      ['LULA FILHO', 88888, 'PT', 7, 'ce', 'Eleito', 90_000],
    ]
    expect(names('lula', extra)).toEqual(['LULA', 'LULA FILHO', 'LULA DA SILVA'])
  })

  it('lists every candidacy that holds a ballot number, even past 20', () => {
    const extra: CandidacyEntry[] = Array.from({ length: 26 }, (_, n) => [
      `CANDIDATO ${n}`,
      4444,
      'PT',
      6,
      `s${String.fromCharCode(97 + n)}`,
      'Não eleito',
      n,
    ])
    const found = search(index(extra), '4444')
    expect(found.hits).toHaveLength(26)
    expect(found.more).toBe(false)
  })

  it('waits for two characters', () => {
    expect(search(index(), 's')).toEqual({ hits: [], more: false })
  })

  it('caps the results at 20 and says when more match', () => {
    const extra: CandidacyEntry[] = Array.from({ length: 30 }, (_, n) => [
      `MARIA ${n}`,
      10_000 + n,
      'PT',
      6,
      'sp',
      'Não eleito',
      n,
    ])
    const found = search(index(extra), 'maria')
    expect(found.hits).toHaveLength(MAX_RESULTS)
    expect(found.more).toBe(true)
    expect(search(index(), 'recife').more).toBe(false)
  })
})

describe('hitHref', () => {
  it('sends a municipality or a city abroad to its view', () => {
    const [recife, lisbon] = [search(index(), 'recife').hits[0], search(index(), 'lisboa').hits[0]]
    expect(recife && hitHref(recife, 'pt')).toBe('/2026/municipio/?uf=pe&mu=25313')
    expect(lisbon && hitHref(lisbon, 'en')).toBe('/en/2026/municipio/?uf=zz&mu=29505')
  })

  it('sends President, Governor and Senate candidacies to their pages, and a deputy to its row', () => {
    const [lula] = search(index(), 'lula').hits
    const [deputy] = search(index(), 'abimael').hits
    const [senator] = search(index(), 'humberto').hits
    expect(lula && hitHref(lula, 'pt')).toBe('/2026/presidente/13/')
    expect(deputy && hitHref(deputy, 'pt')).toBe('/2026/pe/deputado-estadual/#candidato-22622')
    expect(senator && hitHref(senator, 'en')).toBe('/en/2026/pe/senador/130/')
    expect(deputy && hitHref(deputy, 'pt').endsWith(`#${candidateRowId(22622)}`)).toBe(true)
  })

  it('refuses a race the app does not know', () => {
    const [deputy] = search(index(), 'abimael').hits
    expect(() => deputy && hitHref({ ...deputy, race: 99 } as typeof deputy, 'pt')).toThrow(
      /unknown race, 99/,
    )
  })
})
