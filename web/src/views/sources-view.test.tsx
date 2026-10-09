import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DATA_VERSIONS, versionUrl } from '@/data-version'
import type { Manifest } from '@/lib/manifest'
import { SourcesContent } from './sources-view'

const PINNED = DATA_VERSIONS[1]
const PLACES = {
  rounds: [1 as const],
  assetBase: '/assets',
  workerScript: '/worker.js',
  searchBase: '/busca/0',
  geoBase: 'https://worker.test/assets/geo/ibge-2025/20261008-e556c48-37807969229',
  geoSha256: {},
}

const PUBLISHED = { version: PINNED.name, dataBase: versionUrl(PINNED), synthetic: false }
const FIXTURES = { version: null, dataBase: '/_fixtures/data', synthetic: false }

const manifest = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '..', '..', 'fixtures', 'manifest.json'), 'utf-8'),
) as Manifest

describe('the sources page', () => {
  it('shows the pinned version and links to its manifest', () => {
    const html = renderToStaticMarkup(
      <SourcesContent
        locale="pt"
        manifest={manifest}
        source={{ mode: 'published', ...PLACES }}
        version={PUBLISHED}
      />,
    )
    expect(html).toContain(PINNED.name)
    expect(html).toContain(`href="${versionUrl(PINNED)}/manifest.json"`)
  })

  it('names the boundary build in use, its terms and its manifest', () => {
    const html = renderToStaticMarkup(
      <SourcesContent
        locale="en"
        manifest={manifest}
        source={{ mode: 'published', ...PLACES }}
        version={PUBLISHED}
      />,
    )
    expect(html).toContain('20261008-e556c48-37807969229')
    expect(html).toContain(`href="${PLACES.geoBase}/manifest.json"`)
    expect(html).toContain('compatible with CC BY 4.0')
    expect(html).toContain(
      'href="https://biblioteca.ibge.gov.br/visualizacao/livros/liv102268.pdf"',
    )
    expect(html).toContain('simplified')
  })

  it.each([
    ['pt', 'em letras maiúsculas'],
    ['en', 'in capital letters'],
  ] as const)('says in %s that names were recased from TSE’s capitals', (locale, phrase) => {
    const html = renderToStaticMarkup(
      <SourcesContent
        locale={locale}
        manifest={manifest}
        source={{ mode: 'fixtures', ...PLACES }}
        version={FIXTURES}
      />,
    )
    expect(html).toContain(phrase)
    expect(html).toContain('PSOL')
  })

  it('says a fixtures build is a test build, with no manifest link', () => {
    const html = renderToStaticMarkup(
      <SourcesContent
        locale="en"
        manifest={manifest}
        source={{ mode: 'fixtures', ...PLACES }}
        version={FIXTURES}
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
        source={{ mode: 'fixtures', ...PLACES }}
        version={FIXTURES}
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
          source={{ mode: 'fixtures', ...PLACES }}
          version={FIXTURES}
        />,
      ),
    ).toThrow(/no terms recorded/)
  })
})
