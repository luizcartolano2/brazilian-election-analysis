import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = path.join(import.meta.dirname, 'vercel-ignore-build.sh')
const BUILD = 1
const SKIP = 0

let repo: string
let edits = 0

function git(...args: string[]): string {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf-8',
    // The developer's own hooks, signing and templates stay out of the temporary repository.
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  }).trim()
}

function commit(file: string): string {
  const target = path.join(repo, file)
  mkdirSync(path.dirname(target), { recursive: true })
  edits += 1
  writeFileSync(target, `${file} ${edits}\n`)
  git('add', '-A')
  git('commit', '-q', '-m', file)
  return git('rev-parse', 'HEAD')
}

function decide(previous: string | undefined, target = 'production'): number | null {
  const env: NodeJS.ProcessEnv = { ...process.env, VERCEL_ENV: target }
  delete env.VERCEL_GIT_PREVIOUS_SHA
  if (previous !== undefined) env.VERCEL_GIT_PREVIOUS_SHA = previous
  return spawnSync('sh', [SCRIPT], { cwd: path.join(repo, 'web'), env }).status
}

describe('the Ignored Build Step', () => {
  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), 'ignore-build-'))
    git('init', '-q')
  })

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('builds production with no earlier deployment, whatever changed', () => {
    commit('web/page.tsx')
    commit('README.md')
    expect(decide(undefined)).toBe(BUILD)
    expect(decide('')).toBe(BUILD)
  })

  it('skips the first preview of a branch whose last commit leaves web/ unchanged', () => {
    commit('web/page.tsx')
    commit('openspec/changes/proposal.md')
    expect(decide(undefined, 'preview')).toBe(SKIP)
  })

  it('builds the first preview of a branch whose last commit changes web/', () => {
    commit('README.md')
    commit('web/page.tsx')
    expect(decide(undefined, 'preview')).toBe(BUILD)
  })

  it('builds the first preview when the commit has no parent in the clone', () => {
    commit('web/page.tsx')
    expect(decide(undefined, 'preview')).toBe(BUILD)
  })

  it('skips when only files outside web/ changed', () => {
    const deployed = commit('web/page.tsx')
    commit('openspec/changes/proposal.md')
    commit('README.md')
    expect(decide(deployed)).toBe(SKIP)
  })

  it('builds when web/ changed in any commit since the last deployment', () => {
    const deployed = commit('web/page.tsx')
    commit('web/vercel.json')
    commit('README.md')
    expect(decide(deployed)).toBe(BUILD)
  })

  it('builds when the earlier deployment is not in the clone', () => {
    commit('web/page.tsx')
    expect(decide('0123456789abcdef0123456789abcdef01234567')).toBe(BUILD)
  })
})
