import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FixturesNotice } from './page-shell'

describe('FixturesNotice', () => {
  it('says that a synthetic round copies round 1, in each language', () => {
    const pt = renderToStaticMarkup(<FixturesNotice locale="pt" synthetic />)
    const en = renderToStaticMarkup(<FixturesNotice locale="en" synthetic />)
    expect(pt).toContain('este 2º turno é sintético')
    expect(pt).toContain('nem uma previsão')
    expect(en).toContain('this round 2 is synthetic')
    expect(en).toContain('nor a forecast')
  })

  it('keeps the sample notice on a round cut from TSE’s files', () => {
    const html = renderToStaticMarkup(<FixturesNotice locale="en" synthetic={false} />)
    expect(html).toContain('come from a sample of TSE')
    expect(html).not.toContain('synthetic')
  })
})
