import { createHash } from 'node:crypto'

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
}

export class DataVersionError extends Error {}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function parseManifest(bytes: Uint8Array): Manifest {
  const manifest = JSON.parse(new TextDecoder().decode(bytes)) as Manifest
  if (!Array.isArray(manifest.arquivos) || !Array.isArray(manifest.estados)) {
    throw new DataVersionError('manifest.json has no file list or no state list')
  }
  return manifest
}

/** Checks the pinned version's manifest. `bytes` is null when the version has no manifest. */
export function verifyManifest(bytes: Uint8Array | null, expectedSha256: string): Manifest {
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
  const manifest = parseManifest(bytes)
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

export function summaryPaths(manifest: Manifest): string[] {
  return manifest.arquivos
    .map((file) => file.path)
    .filter((path) => /^\d{4}\/t\d\/resumo\/[a-z]{2}\.json$/.test(path))
    .sort()
}
