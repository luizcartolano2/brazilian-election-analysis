import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRESIDENT } from '../src/lib/elections'
import type { Summary } from '../src/lib/results'
import { CANDIDACY_FIELDS, checkIndexFile, MUNICIPALITY_FIELDS } from '../src/lib/search'
import { buildSearchIndex } from './search-index'

const SUMMARIES = path.join(import.meta.dirname, '..', 'fixtures', '2026', 't1', 'resumo')

function fixtureSummaries(): Map<string, Summary> {
  const summaries = new Map<string, Summary>()
  for (const file of readdirSync(SUMMARIES)) {
    const summary = JSON.parse(readFileSync(path.join(SUMMARIES, file), 'utf-8')) as Summary
    summaries.set(path.basename(file, '.json'), summary)
  }
  return summaries
}

const MUNICIPALITIES = {
  pe: [{ municipio: 25313, nome: 'RECIFE', capital: true }],
  zz: [{ municipio: 29173, nome: 'KATMANDU', capital: false }],
}

describe('buildSearchIndex', () => {
  it('lists each President candidacy once, for Brazil', () => {
    const { candidatos } = buildSearchIndex(fixtureSummaries(), MUNICIPALITIES)
    const president = candidatos.linhas.filter((row) => row[3] === PRESIDENT)
    const brazil = fixtureSummaries().get('br')?.corridas[0]?.candidatos ?? []
    expect(president).toHaveLength(brazil.length)
    expect(new Set(president.map((row) => row[4]))).toEqual(new Set(['br']))
  })

  it('lists every other candidacy in the state summaries', () => {
    const summaries = fixtureSummaries()
    const { candidatos } = buildSearchIndex(summaries, MUNICIPALITIES)
    let expected = 0
    for (const [area, summary] of summaries) {
      if (area === 'br') continue
      for (const race of summary.corridas) {
        if (race.cargo !== PRESIDENT) expected += race.candidatos.length
      }
    }
    expect(candidatos.linhas.filter((row) => row[3] !== PRESIDENT)).toHaveLength(expected)
  })

  it('writes exactly the allowed fields', () => {
    const { municipios, candidatos } = buildSearchIndex(fixtureSummaries(), MUNICIPALITIES)
    expect(municipios.campos).toEqual(MUNICIPALITY_FIELDS)
    expect(candidatos.campos).toEqual(CANDIDACY_FIELDS)
    expect(municipios.linhas).toContainEqual(['KATMANDU', 'zz', 29173, false])
  })

  it('never copies a field the summary holds beyond the allowed ones', () => {
    const summaries = fixtureSummaries()
    const race = summaries.get('pe')?.corridas[1]
    const candidate = race?.candidatos[0] as unknown as Record<string, unknown>
    candidate.cpf = '00000000000'
    const { candidatos } = buildSearchIndex(summaries, MUNICIPALITIES)
    expect(JSON.stringify(candidatos)).not.toContain('00000000000')
  })
})

describe('checkIndexFile', () => {
  it('fails on a field outside the allowed ones', () => {
    const file = { campos: [...MUNICIPALITY_FIELDS, 'cpf'], linhas: [] }
    expect(() => checkIndexFile('municipios.json', file, MUNICIPALITY_FIELDS)).toThrow(
      /only nome, area, municipio, capital are allowed/,
    )
  })

  it('fails on a row with an extra value', () => {
    const file = { campos: MUNICIPALITY_FIELDS, linhas: [['RECIFE', 'pe', 25313, true, 'x']] }
    expect(() => checkIndexFile('municipios.json', file, MUNICIPALITY_FIELDS)).toThrow(/row 0/)
  })

  it('fails on a value of the wrong type', () => {
    const file = { campos: MUNICIPALITY_FIELDS, linhas: [['RECIFE', 'pe', '25313', true]] }
    expect(() => checkIndexFile('municipios.json', file, MUNICIPALITY_FIELDS)).toThrow(/row 0/)
  })
})
