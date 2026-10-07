import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DATA_VERSION, VERSION_URL } from '@/data-version'
import type { Manifest } from '@/lib/manifest'
import { SourcesContent } from './sources-view'

const PLACES = { dataBase: '/data', assetBase: '/assets', workerScript: '/worker.js' }

const manifest = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '..', '..', 'fixtures', 'manifest.json'), 'utf-8'),
) as Manifest

describe('the sources page', () => {
  it('shows the pinned version and links to its manifest', () => {
    const html = renderToStaticMarkup(
      <SourcesContent
        locale="pt"
        manifest={manifest}
        source={{ mode: 'published', version: DATA_VERSION.name, ...PLACES }}
      />,
    )
    expect(html).toContain(DATA_VERSION.name)
    expect(html).toContain(`href="${VERSION_URL}/manifest.json"`)
  })

  it('says a fixtures build is a test build, with no manifest link', () => {
    const html = renderToStaticMarkup(
      <SourcesContent
        locale="en"
        manifest={manifest}
        source={{ mode: 'fixtures', version: null, ...PLACES }}
      />,
    )
    expect(html).toContain('test build')
    expect(html).not.toContain('manifest.json"')
  })

  it('states the terms of each TSE host apart', () => {
    const html = renderToStaticMarkup(
      <SourcesContent
        locale="en"
        manifest={manifest}
        source={{ mode: 'fixtures', version: null, ...PLACES }}
      />,
    )
    expect(html).toContain('CC BY license, which the portal declares')
    expect(html).toContain('The site states no license')
  })

  it('refuses a source from a host with no recorded terms', () => {
    const odd = {
      ...manifest,
      fontes: [{ ...manifest.fontes[0]!, url: 'https://example.com/x.json' }],
    }
    expect(() =>
      renderToStaticMarkup(
        <SourcesContent
          locale="pt"
          manifest={odd}
          source={{ mode: 'fixtures', version: null, ...PLACES }}
        />,
      ),
    ).toThrow(/no terms recorded/)
  })
})
