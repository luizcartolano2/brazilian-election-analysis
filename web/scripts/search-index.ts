/** Builds the search index from the verified summaries and municipality list. */
import { PRESIDENT, raceByCode } from '../src/lib/elections'
import type { Summary } from '../src/lib/results'
import {
  CANDIDACY_FIELDS,
  checkIndexFile,
  MUNICIPALITY_FIELDS,
  type CandidacyEntry,
  type IndexFile,
  type MunicipalityEntry,
} from '../src/lib/search'

export interface SearchIndexFiles {
  municipios: IndexFile<MunicipalityEntry>
  candidatos: IndexFile<CandidacyEntry>
}

/**
 * `summaries` and `municipalities` are keyed by lower-case area: `br`, a state or `zz`.
 * President comes from `br` only, because every state's summary repeats it.
 */
export function buildSearchIndex(
  summaries: Map<string, Summary>,
  municipalities: Record<string, { municipio: number; nome: string; capital: boolean }[]>,
): SearchIndexFiles {
  const municipios: IndexFile<MunicipalityEntry> = { campos: MUNICIPALITY_FIELDS, linhas: [] }
  for (const area of Object.keys(municipalities).sort()) {
    for (const entry of municipalities[area] ?? []) {
      municipios.linhas.push([entry.nome, area, entry.municipio, entry.capital])
    }
  }

  const candidatos: IndexFile<CandidacyEntry> = { campos: CANDIDACY_FIELDS, linhas: [] }
  for (const area of [...summaries.keys()].sort()) {
    for (const race of (summaries.get(area) as Summary).corridas) {
      if ((race.cargo === PRESIDENT) !== (area === 'br')) continue
      if (raceByCode(race.cargo) === undefined) {
        throw new Error(`${area}.json holds race ${race.cargo}, which the app does not know`)
      }
      for (const candidate of race.candidatos) {
        candidatos.linhas.push([
          candidate.nome,
          candidate.numero,
          candidate.partido,
          race.cargo,
          area,
          candidate.resultado,
          candidate.votos,
        ])
      }
    }
  }

  checkIndexFile('municipios.json', municipios as IndexFile<unknown[]>, MUNICIPALITY_FIELDS)
  checkIndexFile('candidatos.json', candidatos as IndexFile<unknown[]>, CANDIDACY_FIELDS)
  return { municipios, candidatos }
}
