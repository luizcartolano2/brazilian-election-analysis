import { YEAR, type Round } from '../elections'

/** A file's path inside a round's data version. Built only from parsed address values. */
export function roundFiles(round: Round) {
  const root = `${YEAR}/t${round}`
  return {
    municipalities: () => `${YEAR}/municipios.parquet`,
    candidates: () => `${root}/candidatos.parquet`,
    stationVotes: (race: number, area: string) =>
      `${root}/votos/cargo=${race}/uf=${area.toUpperCase()}.parquet`,
    stationTurnout: (area: string) => `${root}/comparecimento/uf=${area.toUpperCase()}.parquet`,
    places: (area: string) => `${root}/secoes/uf=${area.toUpperCase()}.parquet`,
    municipalityVotes: (race: number, area: string) =>
      `${root}/totais/municipio/cargo=${race}/uf=${area.toUpperCase()}.parquet`,
    municipalityTurnout: (area: string) =>
      `${root}/totais/municipio/comparecimento/uf=${area.toUpperCase()}.parquet`,
    zoneVotes: (race: number, area: string) =>
      `${root}/totais/zona/cargo=${race}/uf=${area.toUpperCase()}.parquet`,
    zoneTurnout: (area: string) =>
      `${root}/totais/zona/comparecimento/uf=${area.toUpperCase()}.parquet`,
  }
}
