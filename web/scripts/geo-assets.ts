/** The pinned IBGE boundary source, and the settings that turn it into a published build. */

export interface GeoSource {
  url: string
  sha512: string
  bytes: number
  /** The shapefile's layer inside the zip. */
  layer: string
}

export const GEO_EDITION = 'ibge-2025'

export const GEO_SOURCE: GeoSource = {
  url: 'https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2025/Brasil/BR_Municipios_2025.zip',
  sha512:
    'd80966517d4543e717b4c54a0ad538543a4daf5409a890ed485bd6e85b4114a984fbe1b895d97c940c4c89f8f9b324e1e000a71d5a790fcd9c5d1fb378a49fd9',
  bytes: 237_062_431,
  layer: 'BR_Municipios_2025',
}

export interface OutputSettings {
  /** The simplification interval in meters, in the projected coordinates. */
  intervalM: number
  quantization: number
  /** Raw bytes. */
  maxBytes: number
}

export interface GeoSettings {
  projection: string
  /** A part farther than this from its municipality's largest part is dropped. */
  farPartKm: number
  brazil: OutputSettings
  state: OutputSettings
}

// Albers equal-area for Brazil, so each municipality keeps its true share of the map.
export const GEO_SETTINGS: GeoSettings = {
  projection: '+proj=aea +lat_0=-12 +lon_0=-54 +lat_1=-2 +lat_2=-22 +ellps=GRS80',
  farPartKm: 100,
  brazil: { intervalM: 5000, quantization: 10_000, maxBytes: 1_000_000 },
  state: { intervalM: 400, quantization: 100_000, maxBytes: 600_000 },
}

export interface ExpectedDrop {
  municipio: number
  nome: string
  /** Rounded to three decimals, which tells the parts of one municipality apart. */
  areaKm2: number
}

/** Each part that the staging may drop. Any other far part fails the run. */
export const EXPECTED_DROPS: ExpectedDrop[] = [
  { municipio: 3205309, nome: 'Vitória (Trindade)', areaKm2: 10.277 },
  { municipio: 3205309, nome: 'Vitória (Martim Vaz)', areaKm2: 0.316 },
  { municipio: 3205309, nome: 'Vitória (Martim Vaz)', areaKm2: 0.041 },
  { municipio: 3205309, nome: 'Vitória (Martim Vaz)', areaKm2: 0.037 },
  { municipio: 3205309, nome: 'Vitória (Martim Vaz)', areaKm2: 0.004 },
]

/** IBGE's two lagoon areas in Rio Grande do Sul, which belong to no municipality. */
export const LAGOONS = [4300001, 4300002]

/** IBGE's state code to the app's area code. */
export const STATE_CODES: Record<string, string> = {
  '11': 'ro',
  '12': 'ac',
  '13': 'am',
  '14': 'rr',
  '15': 'pa',
  '16': 'ap',
  '17': 'to',
  '21': 'ma',
  '22': 'pi',
  '23': 'ce',
  '24': 'rn',
  '25': 'pb',
  '26': 'pe',
  '27': 'al',
  '28': 'se',
  '29': 'ba',
  '31': 'mg',
  '32': 'es',
  '33': 'rj',
  '35': 'sp',
  '41': 'pr',
  '42': 'sc',
  '43': 'rs',
  '50': 'ms',
  '51': 'mt',
  '52': 'go',
  '53': 'df',
}

/** IBGE asks for credit and for a statement that the geometry changed. */
export const GEO_CREDIT = {
  pt: 'Limites municipais: IBGE, Malha Municipal Digital 2025, sob licença compatível com CC BY 4.0. Geometria simplificada e reprojetada por este projeto. Limites aproximados, não oficiais.',
  en: 'Municipal boundaries: IBGE, Malha Municipal Digital 2025, under a license compatible with CC BY 4.0. Geometry simplified and reprojected by this project. Approximate boundaries, not official ones.',
  terms: 'https://biblioteca.ibge.gov.br/visualizacao/livros/liv102268.pdf',
}
