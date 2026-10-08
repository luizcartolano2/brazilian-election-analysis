/** The pinned IBGE boundary source, and the settings that turn it into a published build. */
import { IBGE_STATES } from '../src/lib/elections'

export interface GeoSource {
  url: string
  sha512: string
  bytes: number
  /** The shapefile's layer inside the zip. */
  layer: string
}

export const GEO_EDITION = 'ibge-2025'

/** The published boundary build the app reads, and the SHA-256 of each of its files. */
export const GEO_BUILD = {
  path: 'assets/geo/ibge-2025/20261008-e556c48-37807969229',
  sha256: {
    'ac.json': 'd146a0942cb81c55aa407c0c98f9faab6f8595175dc043e2066088f459662b77',
    'al.json': '581b6a8f46acae1a40e616840fe4b0b69e11f1e6b2592c8f87fc845b08dc1799',
    'am.json': '1aa92a079d82ced9ccdfbd6e1eea48df7f4de31e1e5063c7f1a5f220a2b806f0',
    'ap.json': '8db99c9ef2b1e6937a3ef98fa959b7a5ce55c5389891dbb6364b7a6986aea207',
    'ba.json': 'c3d798f12b06bfc9c329b86084c6bb7876bba27f39e43c36f18cfbdf5a84c4ed',
    'br.json': '80893b2f5bb1e0515e936eff4e743b4550e1e125054e6361a4c2e2ce5852ff54',
    'ce.json': 'c75214f10cfe5886cd0c07d1047e876b1f4be66ce440338d63a6d614175176e1',
    'df.json': 'a0b921cd2fb77676424a38880ccf4a57d6acecc64e1250f952d079f599f6d329',
    'es.json': '1853203240d487b859db13b482bbe4c538c3fd3d014c5a600f220c1911243079',
    'go.json': '4533c411f925e0e503782a506098dea9359898d33059465038283d926a36450a',
    'ma.json': '81ad208633cc0b749cd03ff5bcdbc8091eea3e2c73c8f2820409fa823bf0b737',
    'mg.json': 'b23573c036dc5ace6c4ff4be21409979065a3733a14d2b320278d34b3bd9a7e0',
    'ms.json': '1087f38f733b606d63aefca83345ceb3a6a8fadb5c29a785a4cad34d87b40bf8',
    'mt.json': '094239cbb0bf295dc46ac5b39d1769340acb2ab43c6b67caa19d03ccad867a6e',
    'pa.json': 'ee0084e3494d5783b23d0358e92110dc397d5413bce208b038e884b30495bf43',
    'pb.json': 'c657169049aa3acdff13714bb78cb4c8aba70e4854315f2f0d762b323c563537',
    'pe.json': '28894262e12097660b7a79d2aeb62bbaf0ac9e15d05f6be76be02fc1ffff2a2d',
    'pi.json': 'dbcc472434d9d2d558397676ad333008e492d4c7d1d131ffcc5f38387eec85a8',
    'pr.json': 'ab8596ff1c188bfdbb844fc32f19d66959052ab395a59dab46a7b7bd2d86af59',
    'rj.json': '664450703645a9633814c3b2353c3d3c579520d73991fc5ee58f782036dde42c',
    'rn.json': '2222e7ec7e329cf5ff877d6f09c4bae8047db0f05320dd9363d03a74c7d3ef21',
    'ro.json': 'e0643cd73ae5d6f7f2a3c98d0e37896954b7794bc9b8f3286b6fe8f8334b9ab4',
    'rr.json': 'c4a327237cba663e67c1c2f6dd4668513084f28d0ee6abf504311c952fe01cca',
    'rs.json': '1f2e2e101194e6519cfff8fae0f9a36f3475f9917753d726007de160277a60a4',
    'sc.json': '97e3eaf28a9355e970f20f22aa82949b8b3721807804cfd5bbc30cec436f02e9',
    'se.json': 'a2fa8584d4ee299bddeb0e76d6a60cde46238e3d8b81806c0d16fdfdad0c96f6',
    'sp.json': '8a1b6bd8a25555e785e71d34aeb0a82f701e98a7c8659cdde34ed692b8cb0066',
    'to.json': 'aa69f29da157c3462d027940965664e43b47c69acc5c478b5d17f07d8c7f6970',
  } as Record<string, string>,
}

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
export const STATE_CODES = IBGE_STATES

/** IBGE asks for credit and for a statement that the geometry changed. */
export const GEO_CREDIT = {
  pt: 'Limites municipais: IBGE, Malha Municipal Digital 2025, sob licença compatível com CC BY 4.0. Geometria simplificada e reprojetada por este projeto. Limites aproximados, não oficiais.',
  en: 'Municipal boundaries: IBGE, Malha Municipal Digital 2025, under a license compatible with CC BY 4.0. Geometry simplified and reprojected by this project. Approximate boundaries, not official ones.',
  terms: 'https://biblioteca.ibge.gov.br/visualizacao/livros/liv102268.pdf',
}
