export interface PinnedVersion {
  name: string
  manifestSha256: string
}

/** The Worker's origin must also appear in vercel.json's connect-src, which a test checks. */
export const WORKER_URL = 'https://eleicoes-data.luizcartolano.workers.dev'

/**
 * The data version the app reads for each round. Round 2 is null until a version holds it. A publish
 * run's summary gives the name and the SHA-256 of its manifest.
 */
export const DATA_VERSIONS: { readonly 1: PinnedVersion; readonly 2: PinnedVersion | null } = {
  1: {
    name: '20261007-67d59ff-37656362427',
    manifestSha256: 'dab6b050d8043cda5927812d34e93d434588d6a4c89ed4be1f9ff106b940378f',
  },
  2: null,
}

export function versionUrl(version: PinnedVersion): string {
  return `${WORKER_URL}/v/${version.name}`
}
