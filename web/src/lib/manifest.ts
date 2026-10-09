import { createHash } from 'node:crypto'
import { YEAR, type Round } from './elections'

export interface ManifestFile {
  path: string
  size: number
  sha256: string
}

export interface ManifestSource {
  key: string
  url: string
  size: number
  sha512: string
  downloaded_at: string
}

export interface Manifest {
  versao_esquema: number
  ano: number
  turno: number
  commit: string
  gerado_em: string
  parcial: boolean
  fontes_tse: boolean
  estados: string[]
  credito: { pt: string; en: string }
  fontes: ManifestSource[]
  arquivos: ManifestFile[]
  /** Set only on test fixtures that the pipeline made up rather than cut from TSE's files. */
  sintetico?: boolean
}

export class DataVersionError extends Error {}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Reads a manifest, and checks that it holds the year and the round it is read for. */
export function parseManifest(bytes: Uint8Array, round: Round): Manifest {
  const manifest = JSON.parse(new TextDecoder().decode(bytes)) as Manifest
  if (!Array.isArray(manifest.arquivos) || !Array.isArray(manifest.estados)) {
    throw new DataVersionError('manifest.json has no file list or no state list')
  }
  if (manifest.ano !== YEAR || manifest.turno !== round) {
    throw new DataVersionError(
      `the version for round ${round} holds ${manifest.ano} round ${manifest.turno}, not ${YEAR} round ${round}`,
    )
  }
  return manifest
}

/** Checks a pinned version's manifest. `bytes` is null when the version has no manifest. */
export function verifyManifest(
  bytes: Uint8Array | null,
  expectedSha256: string,
  round: Round,
): Manifest {
  if (bytes === null) {
    throw new DataVersionError(
      'the pinned data version has no manifest.json, so it is incomplete or does not exist',
    )
  }
  const actual = sha256(bytes)
  if (actual !== expectedSha256) {
    throw new DataVersionError(
      `manifest.json has SHA-256 ${actual}, but data-version.ts pins ${expectedSha256}`,
    )
  }
  const manifest = parseManifest(bytes, round)
  if (manifest.parcial !== false || manifest.fontes_tse !== true) {
    throw new DataVersionError('the pinned version is partial or was built from files outside TSE')
  }
  return manifest
}

/** Checks one data file against its manifest entry. */
export function verifyFile(manifest: Manifest, path: string, bytes: Uint8Array | null): void {
  const entry = manifest.arquivos.find((file) => file.path === path)
  if (entry === undefined) {
    throw new DataVersionError(`${path} is not in the manifest`)
  }
  if (bytes === null) {
    throw new DataVersionError(`${path} is in the manifest but could not be read`)
  }
  if (bytes.byteLength !== entry.size || sha256(bytes) !== entry.sha256) {
    throw new DataVersionError(`${path} differs from its manifest entry`)
  }
}

/** The summaries of the manifest's own year and round, and no other. */
export function summaryPaths(manifest: Manifest): string[] {
  const summaryPath = new RegExp(`^${YEAR}/t${manifest.turno}/resumo/[a-z]{2}\\.json$`)
  return manifest.arquivos
    .map((file) => file.path)
    .filter((path) => summaryPath.test(path))
    .sort()
}
