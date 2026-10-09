/** Map values by municipality, the checks that tie them to the summaries, and the margin bins. */
import { displayName } from './names'
import { VALID, VALID_LIST, type SummaryRace } from './results'

export const CANDIDATE = 1
export const PARTY_LIST = 2
const ANNULLED = 6
const ANNULLED_SUB_JUDICE = 7

/**
 * A most-voted map shades by margin. A Senate map does not, because two win. A share map
 * shades one candidate's share of the valid votes.
 */
export type MapKind = 'margin' | 'senate' | 'share'

/**
 * One municipality: its IBGE and TSE codes, its name, its two most voted as indexes into
 * `MapData.units` with their votes, and its valid votes. An index of -1 means nobody.
 */
export type MapRow = [
  ibge: number,
  municipio: number,
  nome: string,
  first: number,
  firstVotes: number,
  second: number,
  secondVotes: number,
  valid: number,
]

export interface MapData {
  kind: MapKind
  /** Most voted in the race's whole area first, so the first two take the two colors. */
  units: string[]
  rows: MapRow[]
  /** A share map's step, in percentage points: 10 for President and Governor, 5 for Senate. */
  step?: number
}

/** The steps of a share map: six, the last of them open. */
export const SHARE_STEPS = 6

/**
 * Each candidate's votes by municipality in one race: the IBGE and TSE codes, the name, the
 * valid votes, then one column per number in `numbers`.
 */
export interface CandidateVotes {
  numbers: number[]
  rows: [number, number, string, number, ...number[]][]
}

// A majoritarian unit reads "NAME (PARTY)". A deputy race's units are parties and federations.
function displayUnit(unit: string): string {
  const open = unit.lastIndexOf(' (')
  return open === -1 ? displayName(unit) : displayName(unit.slice(0, open)) + unit.slice(open)
}

/** The map with municipality names, and a majoritarian race's candidate names, in title case. */
export function withDisplayNames(data: MapData, proportional: boolean): MapData {
  return {
    ...data,
    units: proportional ? data.units : data.units.map(displayUnit),
    rows: data.rows.map(([ibge, municipio, nome, ...rest]) => [
      ibge,
      municipio,
      displayName(nome),
      ...rest,
    ]),
  }
}

/** The votes with municipality names in title case. */
export function votesWithDisplayNames(votes: CandidateVotes): CandidateVotes {
  return {
    ...votes,
    rows: votes.rows.map(([ibge, municipio, nome, ...rest]) => [
      ibge,
      municipio,
      displayName(nome),
      ...rest,
    ]),
  }
}

/** One candidate's column as a share map. A row's leader is the candidate, with its votes. */
export function shareMap(
  votes: CandidateVotes,
  numero: number,
  label: string,
  step: number,
): MapData | null {
  const column = votes.numbers.indexOf(numero)
  if (column === -1) return null
  return {
    kind: 'share',
    step,
    units: [label],
    rows: votes.rows.map(([ibge, municipio, nome, valid, ...counts]) => [
      ibge,
      municipio,
      nome,
      0,
      counts[column] ?? 0,
      -1,
      0,
      valid,
    ]),
  }
}

/** A share's step, from 0 for under one step up to the last, which has no upper limit. */
export function stepOf(row: MapRow, step: number): number {
  const [, , , , votes, , , valid] = row
  const percent = valid > 0 ? (votes / valid) * 100 : 0
  return Math.min(SHARE_STEPS - 1, Math.floor(percent / step))
}

/** A vote row's type and number, and the unit it counts for. */
export type UnitOf = [tipo: number, numero: number, unit: number]

export interface RaceUnits {
  kind: MapKind
  units: string[]
  mapping: UnitOf[]
}

/**
 * Each candidate's map color, by ballot number: 0 and 1 for the two most voted in
 * `colorRace`, as on the race's maps. Every other candidate is absent and takes the gray.
 */
export function candidateRanks(
  race: SummaryRace,
  colorRace: SummaryRace = race,
): ReadonlyMap<number, 0 | 1> {
  const { mapping } = raceUnits(race, false, new Map(), colorRace)
  return new Map(
    mapping
      .filter(([, , unit]) => unit < 2)
      .map(([, numero, unit]) => [numero, unit === 0 ? 0 : 1] as const),
  )
}

/** A state with more than one municipality. The Federal District has one, and abroad none. */
export function isMappedArea(area: string, municipalities: number): boolean {
  return area !== 'zz' && municipalities > 1
}

/** The short form after " - ", or the name without the word "FEDERAÇÃO". */
export function federationLabel(name: string): string {
  const dash = name.indexOf(' - ')
  if (dash !== -1) return name.slice(dash + 3).trim()
  return name.replace(/FEDERAÇÃO/i, '').trim()
}

function rank<T extends { key: string; votes: number }>(entries: Iterable<T>): T[] {
  return [...entries].sort((a, b) => b.votes - a.votes || a.key.localeCompare(b.key))
}

/**
 * What each vote counts for on a race's map. Candidates are the units of a majoritarian race.
 * A deputy race counts for federations, or for parties outside any federation. A candidate's
 * party comes from the summary, never from the digits of the ballot number. `colorRace`
 * ranks the units: Brazil's for President, so a candidate keeps one color on every map.
 */
export function raceUnits(
  race: SummaryRace,
  proportional: boolean,
  federations: Map<string, string>,
  colorRace: SummaryRace = race,
): RaceUnits {
  const kind: MapKind = race.escolhas_por_eleitor > 1 && !proportional ? 'senate' : 'margin'
  if (!proportional) {
    const ranked = rank(
      colorRace.candidatos
        .filter((candidate) => candidate.destino === VALID)
        .map((candidate) => ({
          key: String(candidate.numero),
          votes: candidate.votos,
          label: `${candidate.nome} (${candidate.partido})`,
          numero: candidate.numero,
        })),
    )
    return {
      kind,
      units: ranked.map((unit) => unit.label),
      mapping: ranked.map((unit, index) => [CANDIDATE, unit.numero, index]),
    }
  }

  const unitOfParty = (sigla: string) => federations.get(sigla) ?? sigla
  const totals = new Map<string, { key: string; votes: number; label: string }>()
  const add = (sigla: string, votes: number) => {
    const key = unitOfParty(sigla)
    const label = federations.has(sigla) ? federationLabel(key) : sigla
    const entry = totals.get(key) ?? { key, votes: 0, label }
    entry.votes += votes
    totals.set(key, entry)
  }
  for (const candidate of race.candidatos) {
    if (candidate.destino === VALID) add(candidate.partido, candidate.votos)
  }
  for (const party of race.partidos ?? []) {
    add(party.sigla, party.destino === VALID_LIST ? party.votos_legenda : 0)
  }
  const ranked = rank(totals.values())
  const index = new Map(ranked.map((unit, position) => [unit.key, position]))
  const mapping: UnitOf[] = []
  for (const candidate of race.candidatos) {
    if (candidate.destino !== VALID) continue
    mapping.push([CANDIDATE, candidate.numero, index.get(unitOfParty(candidate.partido)) ?? -1])
  }
  for (const party of race.partidos ?? []) {
    if (party.destino !== VALID_LIST) continue
    mapping.push([PARTY_LIST, party.numero, index.get(unitOfParty(party.sigla)) ?? -1])
  }
  return { kind, units: ranked.map((unit) => unit.label), mapping }
}

/** Votes summed over an area's municipalities, by vote type and number. */
export interface VoteTotal {
  tipo: number
  numero: number
  votos: number
}

/**
 * Compares an area's municipalities with its summary: each candidate's votes, each party's
 * valid candidate votes plus valid list votes, and the valid votes. Returns every difference.
 */
export function checkRaceSums(
  where: string,
  race: SummaryRace,
  proportional: boolean,
  totals: VoteTotal[],
): string[] {
  const sumOf = (filter: (total: VoteTotal) => boolean) =>
    totals.filter(filter).reduce((sum, total) => sum + total.votos, 0)
  const problems: string[] = []
  const compare = (what: string, summary: number, municipalities: number) => {
    if (summary !== municipalities) {
      problems.push(
        `${where}: ${what}: ${summary} votes in the summary, ${municipalities} in its municipalities`,
      )
    }
  }

  // A candidate's votes keep their type: valid, annulled, or annulled sub judice.
  const candidateTypes = new Set([CANDIDATE, ANNULLED, ANNULLED_SUB_JUDICE])
  for (const candidate of race.candidatos) {
    compare(
      `candidate ${candidate.numero} ${candidate.nome}`,
      candidate.votos,
      sumOf((total) => candidateTypes.has(total.tipo) && total.numero === candidate.numero),
    )
  }

  if (proportional) {
    const validCandidates = race.candidatos.filter((candidate) => candidate.destino === VALID)
    for (const party of race.partidos ?? []) {
      const own = validCandidates.filter((candidate) => candidate.partido === party.sigla)
      const numbers = new Set(own.map((candidate) => candidate.numero))
      // A list under appeal counts on neither side: its votes are annulled sub judice.
      const list = party.destino === VALID_LIST
      compare(
        `party ${party.numero} ${party.sigla}`,
        own.reduce((sum, candidate) => sum + candidate.votos, 0) + (list ? party.votos_legenda : 0),
        sumOf(
          (total) =>
            (total.tipo === CANDIDATE && numbers.has(total.numero)) ||
            (total.tipo === PARTY_LIST && total.numero === party.numero),
        ),
      )
    }
  }

  compare(
    'the valid votes',
    race.validos,
    sumOf((total) => total.tipo === CANDIDATE || total.tipo === PARTY_LIST),
  )
  return problems
}

/** A unit's votes in one municipality, as the build sums them. */
export interface UnitVotes {
  municipio: number
  unit: number
  votos: number
}

/** The two most voted of each municipality, with ties broken by the unit's area rank. */
export function mapRows(
  municipalities: { municipio: number; ibge: number; nome: string }[],
  unitVotes: UnitVotes[],
  valid: Map<number, number>,
): MapRow[] {
  const byMunicipality = new Map<number, UnitVotes[]>()
  for (const entry of unitVotes) {
    const list = byMunicipality.get(entry.municipio) ?? []
    list.push(entry)
    byMunicipality.set(entry.municipio, list)
  }
  return municipalities.map((municipality) => {
    const ranked = (byMunicipality.get(municipality.municipio) ?? [])
      .filter((entry) => entry.votos > 0)
      .sort((a, b) => b.votos - a.votos || a.unit - b.unit)
    const [first, second] = ranked
    return [
      municipality.ibge,
      municipality.municipio,
      municipality.nome,
      first?.unit ?? -1,
      first?.votos ?? 0,
      second?.unit ?? -1,
      second?.votos ?? 0,
      valid.get(municipality.municipio) ?? 0,
    ]
  })
}

/** The leader's share of valid votes minus the runner-up's, in percentage points. */
export function marginPoints(row: MapRow): number {
  const [, , , , firstVotes, , secondVotes, valid] = row
  return valid > 0 ? ((firstVotes - secondVotes) / valid) * 100 : 0
}

export interface MunicipalityVotes {
  ibge: number
  municipio: number
  nome: string
  valid: number
  votes: number
}

/** The municipalities with the most valid votes, with one candidate's votes in each. */
export function largestMunicipalities(
  votes: CandidateVotes,
  numero: number,
  count: number,
): MunicipalityVotes[] {
  const column = votes.numbers.indexOf(numero)
  if (column === -1) return []
  return votes.rows
    .map(([ibge, municipio, nome, valid, ...counts]) => ({
      ibge,
      municipio,
      nome,
      valid,
      votes: counts[column] ?? 0,
    }))
    .sort((a, b) => b.valid - a.valid || a.municipio - b.municipio)
    .slice(0, count)
}

/** The rows with the smallest margin between the two most voted, ties first, then by name. */
export function closestRows(data: MapData, count: number): MapRow[] {
  return data.rows
    .filter(([, , , first, , second, , valid]) => first >= 0 && second >= 0 && valid > 0)
    .map((row) => ({ row, margin: marginPoints(row) }))
    .sort((a, b) => a.margin - b.margin || a.row[2].localeCompare(b.row[2], 'pt-BR'))
    .slice(0, count)
    .map(({ row }) => row)
}

/** 0 under 5 points, 1 from 5 to under 20, 2 from 20 up. */
export function binOf(margin: number): 0 | 1 | 2 {
  if (margin < 5) return 0
  if (margin < 20) return 1
  return 2
}

export type Fill =
  | { kind: 'leader'; color: 0 | 1; bin: 0 | 1 | 2 | null }
  | { kind: 'share'; step: number }
  | { kind: 'other' | 'tie' | 'none' }

/**
 * How a municipality is drawn: a leader's color and shade, a share's step, gray, the tie
 * style, or nothing.
 */
export function fillOf(row: MapRow, kind: MapKind, step = 10): Fill {
  const [, , , first, firstVotes, second, secondVotes, valid] = row
  if (kind === 'share') {
    return valid > 0 ? { kind: 'share', step: stepOf(row, step) } : { kind: 'none' }
  }
  if (first === -1) return { kind: 'none' }
  if (second !== -1 && firstVotes === secondVotes) return { kind: 'tie' }
  if (first !== 0 && first !== 1) return { kind: 'other' }
  return { kind: 'leader', color: first, bin: kind === 'senate' ? null : binOf(marginPoints(row)) }
}
