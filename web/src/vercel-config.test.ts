import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DATA_VERSION } from './data-version'

interface VercelConfig {
  headers: { source: string; headers: { key: string; value: string }[] }[]
}

const config = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '..', 'vercel.json'), 'utf-8'),
) as VercelConfig

function header(name: string): string {
  const rule = config.headers.find((entry) => entry.source === '/(.*)')
  const value = rule?.headers.find((entry) => entry.key === name)?.value
  if (value === undefined) throw new Error(`vercel.json sets no ${name} for every path`)
  return value
}

function directive(policy: string, name: string): string[] {
  const found = policy
    .split(';')
    .map((part) => part.trim().split(/\s+/))
    .find(([key]) => key === name)
  return found?.slice(1) ?? []
}

describe('vercel.json', () => {
  const policy = header('Content-Security-Policy')

  it('lets the browser fetch data only from the app and the pinned Worker', () => {
    expect(directive(policy, 'connect-src')).toEqual([
      "'self'",
      new URL(DATA_VERSION.workerUrl).origin,
    ])
  })

  it('keeps the rest of the policy closed', () => {
    expect(directive(policy, 'default-src')).toEqual(["'self'"])
    expect(directive(policy, 'object-src')).toEqual(["'none'"])
    expect(directive(policy, 'frame-ancestors')).toEqual(["'none'"])
    expect(directive(policy, 'base-uri')).toEqual(["'none'"])
  })

  it('applies to every path', () => {
    expect(config.headers.map((entry) => entry.source)).toEqual(['/(.*)'])
  })
})
