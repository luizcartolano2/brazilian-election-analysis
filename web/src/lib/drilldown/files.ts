import { ROUND, YEAR } from '../elections'

const ROUND_ROOT = `${YEAR}/t${ROUND}`

/** A file's path inside a data version. Built only from parsed address values. */
export const FILES = {
  municipalities: () => `${YEAR}/municipios.parquet`,
  candidates: () => `${ROUND_ROOT}/candidatos.parquet`,
  stationVotes: (race: number, area: string) =>
    `${ROUND_ROOT}/votos/cargo=${race}/uf=${area.toUpperCase()}.parquet`,
  stationTurnout: (area: string) => `${ROUND_ROOT}/comparecimento/uf=${area.toUpperCase()}.parquet`,
  places: (area: string) => `${ROUND_ROOT}/secoes/uf=${area.toUpperCase()}.parquet`,
  municipalityVotes: (race: number, area: string) =>
    `${ROUND_ROOT}/totais/municipio/cargo=${race}/uf=${area.toUpperCase()}.parquet`,
  municipalityTurnout: (area: string) =>
    `${ROUND_ROOT}/totais/municipio/comparecimento/uf=${area.toUpperCase()}.parquet`,
  zoneVotes: (race: number, area: string) =>
    `${ROUND_ROOT}/totais/zona/cargo=${race}/uf=${area.toUpperCase()}.parquet`,
  zoneTurnout: (area: string) =>
    `${ROUND_ROOT}/totais/zona/comparecimento/uf=${area.toUpperCase()}.parquet`,
}
