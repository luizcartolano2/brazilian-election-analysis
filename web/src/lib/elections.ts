import type { Locale } from './i18n'

export const YEAR = 2026
export const ROUND = 1

export interface StateInfo {
  code: string
  pt: string
  en: string
}

export const STATES: readonly StateInfo[] = [
  { code: 'ac', pt: 'Acre', en: 'Acre' },
  { code: 'al', pt: 'Alagoas', en: 'Alagoas' },
  { code: 'am', pt: 'Amazonas', en: 'Amazonas' },
  { code: 'ap', pt: 'Amapá', en: 'Amapá' },
  { code: 'ba', pt: 'Bahia', en: 'Bahia' },
  { code: 'ce', pt: 'Ceará', en: 'Ceará' },
  { code: 'df', pt: 'Distrito Federal', en: 'Federal District' },
  { code: 'es', pt: 'Espírito Santo', en: 'Espírito Santo' },
  { code: 'go', pt: 'Goiás', en: 'Goiás' },
  { code: 'ma', pt: 'Maranhão', en: 'Maranhão' },
  { code: 'mg', pt: 'Minas Gerais', en: 'Minas Gerais' },
  { code: 'ms', pt: 'Mato Grosso do Sul', en: 'Mato Grosso do Sul' },
  { code: 'mt', pt: 'Mato Grosso', en: 'Mato Grosso' },
  { code: 'pa', pt: 'Pará', en: 'Pará' },
  { code: 'pb', pt: 'Paraíba', en: 'Paraíba' },
  { code: 'pe', pt: 'Pernambuco', en: 'Pernambuco' },
  { code: 'pi', pt: 'Piauí', en: 'Piauí' },
  { code: 'pr', pt: 'Paraná', en: 'Paraná' },
  { code: 'rj', pt: 'Rio de Janeiro', en: 'Rio de Janeiro' },
  { code: 'rn', pt: 'Rio Grande do Norte', en: 'Rio Grande do Norte' },
  { code: 'ro', pt: 'Rondônia', en: 'Rondônia' },
  { code: 'rr', pt: 'Roraima', en: 'Roraima' },
  { code: 'rs', pt: 'Rio Grande do Sul', en: 'Rio Grande do Sul' },
  { code: 'sc', pt: 'Santa Catarina', en: 'Santa Catarina' },
  { code: 'se', pt: 'Sergipe', en: 'Sergipe' },
  { code: 'sp', pt: 'São Paulo', en: 'São Paulo' },
  { code: 'to', pt: 'Tocantins', en: 'Tocantins' },
]

export const ABROAD: StateInfo = { code: 'zz', pt: 'Exterior', en: 'Abroad' }

export const AREAS: readonly StateInfo[] = [...STATES, ABROAD]

export function areaByCode(code: string): StateInfo | undefined {
  return AREAS.find((area) => area.code === code)
}

export function areaName(area: StateInfo, locale: Locale): string {
  return area[locale]
}

export interface RaceInfo {
  code: number
  slug: string
  pt: string
  en: string
  /** The deputy races, where votes for a party's list also count. */
  proportional: boolean
}

export const RACES: readonly RaceInfo[] = [
  { code: 1, slug: 'presidente', pt: 'Presidente', en: 'President', proportional: false },
  { code: 3, slug: 'governador', pt: 'Governador', en: 'Governor', proportional: false },
  { code: 5, slug: 'senador', pt: 'Senador', en: 'Senator', proportional: false },
  {
    code: 6,
    slug: 'deputado-federal',
    pt: 'Deputado federal',
    en: 'Federal deputy',
    proportional: true,
  },
  {
    code: 7,
    slug: 'deputado-estadual',
    pt: 'Deputado estadual',
    en: 'State deputy',
    proportional: true,
  },
  {
    code: 8,
    slug: 'deputado-distrital',
    pt: 'Deputado distrital',
    en: 'District deputy',
    proportional: true,
  },
  {
    code: 25,
    slug: 'conselheiro-distrital',
    pt: 'Conselheiro distrital',
    en: 'District councillor',
    // Its candidates run without parties, and the seven with the most votes take the seats.
    proportional: false,
  },
]

export function raceByCode(code: number): RaceInfo | undefined {
  return RACES.find((race) => race.code === code)
}

export function raceBySlug(slug: string): RaceInfo | undefined {
  return RACES.find((race) => race.slug === slug)
}

export function raceName(race: RaceInfo, locale: Locale): string {
  return race[locale]
}
