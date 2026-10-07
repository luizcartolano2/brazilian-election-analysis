/**
 * The one data version the app reads. A publish run's summary gives the name and the
 * SHA-256 of its manifest. The Worker's origin must also appear in vercel.json's
 * connect-src, which a test checks.
 */
export const DATA_VERSION = {
  name: '20261007-67d59ff-37656362427',
  manifestSha256: 'dab6b050d8043cda5927812d34e93d434588d6a4c89ed4be1f9ff106b940378f',
  workerUrl: 'https://eleicoes-data.luizcartolano.workers.dev',
} as const

export const VERSION_URL = `${DATA_VERSION.workerUrl}/v/${DATA_VERSION.name}`
