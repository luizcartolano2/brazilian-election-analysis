import type { DrilldownAddress } from './address'
import { electionCode } from './elections'

/** TSE's own results page for one polling station, in the form TSE's results app opens. */
export function tseStationUrl(
  election: number,
  area: string,
  municipality: number,
  zone: number,
  station: number,
): string {
  const query = [
    `e=${election}`,
    `uf=${area}`,
    `mu=${String(municipality).padStart(5, '0')}`,
    `zn=${String(zone).padStart(4, '0')}`,
    `se=${String(station).padStart(4, '0')}`,
  ].join('&')
  return `https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/dados-de-urna/boletim-de-urna?${query}`
}

/** TSE's page for a station view, in the race and round the view shows. Null above a station. */
export function stationLinkOf(address: DrilldownAddress): string | null {
  if (address.zone === null || address.station === null) return null
  return tseStationUrl(
    electionCode(address.race, address.round),
    address.area,
    address.municipality,
    address.zone,
    address.station,
  )
}
