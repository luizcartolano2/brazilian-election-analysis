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
