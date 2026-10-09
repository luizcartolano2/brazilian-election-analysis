import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { WORKER_URL } from './data-version'

interface VercelConfig {
  ignoreCommand: string
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
  it('skips a build through the script that compares web/ with the last deployment', () => {
    expect(config.ignoreCommand).toBe('sh scripts/vercel-ignore-build.sh')
    expect(
      existsSync(path.join(import.meta.dirname, '..', 'scripts', 'vercel-ignore-build.sh')),
    ).toBe(true)
  })

  const policy = header('Content-Security-Policy')

  it('lets the browser fetch data only from the app and the pinned Worker', () => {
    expect(directive(policy, 'connect-src')).toEqual(["'self'", new URL(WORKER_URL).origin])
  })

  it('keeps the rest of the policy closed', () => {
    expect(directive(policy, 'default-src')).toEqual(["'self'"])
    expect(directive(policy, 'object-src')).toEqual(["'none'"])
    expect(directive(policy, 'frame-ancestors')).toEqual(["'none'"])
    expect(directive(policy, 'base-uri')).toEqual(["'none'"])
  })

  it('applies to every path', () => {
    expect(config.headers[0]?.source).toBe('/(.*)')
  })

  it('adds nothing but caching on other paths', () => {
    for (const rule of config.headers.slice(1)) {
      expect(rule.headers.map((entry) => entry.key)).toEqual(['Cache-Control'])
    }
  })

  it('lets browsers keep the search index for good, because its path names its content', () => {
    const rule = config.headers.find((entry) => entry.source === '/busca/(.*)')
    expect(rule?.headers).toEqual([
      { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
    ])
  })
})
