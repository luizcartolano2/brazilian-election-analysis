import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __violations: string[]
  }
}

const STATION = '/2026/secao/?uf=pe&mu=25313&zn=3&se=597&cargo=governador'
const MUNICIPALITY = '/2026/municipio/?uf=pe&mu=25313&cargo=governador'
const NORONHA = '/2026/municipio/?uf=pe&mu=30015'

/** Records the policy violations the page reports. A worker reports its own elsewhere. */
async function watchPolicy(page: Page) {
  await page.addInitScript(() => {
    window.__violations = []
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__violations.push(`${event.violatedDirective} ${event.blockedURI}`)
    })
  })
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

test('a station view shows its results under the production headers', async ({ page }) => {
  const errors = await watchPolicy(page)
  const response = await page.goto(STATION)
  expect(response?.headers()['content-security-policy']).toContain("connect-src 'self'")
  await expect(page.getByRole('heading', { name: 'Seção 597 · Zona 3 · RECIFE' })).toBeVisible()
  await expect(page.getByRole('row', { name: /^Votos válidos/ })).toBeVisible({ timeout: 30_000 })
  expect(await page.evaluate(() => window.__violations)).toEqual([])
  expect(errors).toEqual([])
})

test('a copied station address opens the same station and race', async ({ browser }) => {
  const first = await browser.newPage()
  await first.goto(MUNICIPALITY)
  await first.getByRole('link', { name: 'Zona 3' }).click()
  await first.getByRole('link', { name: 'Seção 597' }).click()
  await expect(first.getByRole('row', { name: /^Votos válidos/ })).toBeVisible({ timeout: 30_000 })
  const copied = first.url()
  const second = await browser.newPage()
  await second.goto(copied)
  await expect(second.getByRole('heading', { name: 'Seção 597 · Zona 3 · RECIFE' })).toBeVisible()
  await expect(second.locator('[aria-current="page"]', { hasText: 'Governador' })).toBeVisible()
  await expect(second.getByRole('row', { name: /^Votos válidos/ })).toBeVisible({ timeout: 30_000 })
})

test('a municipality links to its zones, and a zone to its stations', async ({ page }) => {
  await page.goto(MUNICIPALITY)
  await expect(page.getByRole('heading', { name: 'RECIFE', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Zona 3' })).toHaveAttribute(
    'href',
    '/2026/zona/?uf=pe&mu=25313&zn=3&cargo=governador',
  )
  await page.getByRole('link', { name: 'Zona 3' }).click()
  await expect(page.getByRole('link', { name: 'Seção 597' })).toBeVisible({ timeout: 30_000 })
})

test('an aggregated station points to its principal station and shows no results', async ({
  page,
}) => {
  await page.goto('/2026/secao/?uf=ac&mu=1015&zn=2&se=112')
  await expect(page.getByTestId('aggregated')).toContainText('seção 87', { timeout: 30_000 })
  await expect(page.getByRole('link', { name: 'Ver a seção 87' })).toHaveAttribute(
    'href',
    '/2026/secao/?uf=ac&mu=1015&zn=2&se=87&cargo=presidente',
  )
  await expect(page.getByRole('row', { name: /^Votos válidos/ })).toHaveCount(0)
})

test('a station links to TSE’s own page for it', async ({ page }) => {
  await page.goto('/2026/secao/?uf=ac&mu=1015&zn=2&se=87')
  await expect(page.getByTestId('tse-link')).toHaveAttribute(
    'href',
    'https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/dados-de-urna/boletim-de-urna?e=6257&uf=ac&mu=01015&zn=0002&se=0087',
    { timeout: 30_000 },
  )
})

test('Fernando de Noronha offers its council race, with seven seats and one choice', async ({
  page,
}) => {
  await page.goto(NORONHA)
  await page.getByRole('link', { name: 'Conselheiro distrital' }).click()
  await expect(page.getByText('7 vagas, com uma escolha por eleitor.')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole('heading', { name: 'Votos por partido' })).toHaveCount(0)
})

test('the search finds a polling place by part of its name', async ({ page }) => {
  await page.goto(NORONHA)
  await expect(page.getByRole('row', { name: /^Votos válidos/ })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('searchbox').fill('arquipelago')
  await page.getByRole('button', { name: 'Buscar' }).click()
  const results = page.getByTestId('search-results')
  await expect(results).toContainText('ESCOLA DO ARQUIPÉLAGO DE FERNANDO DE NORONHA')
  await expect(results.getByRole('link', { name: '146' })).toHaveAttribute(
    'href',
    '/2026/secao/?uf=pe&mu=30015&zn=4&se=146&cargo=presidente',
  )
})

test('the search treats quotes as text', async ({ page }) => {
  await page.goto(NORONHA)
  await expect(page.getByRole('row', { name: /^Votos válidos/ })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('searchbox').fill(`d'água" OR 1=1 --`)
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByTestId('search-none')).toBeVisible()
})

test('a failed query shows an error and a retry, and no numbers', async ({ page }) => {
  await page.route('**/*.parquet', (route) => route.abort())
  await page.goto(STATION)
  await expect(page.getByText('Não foi possível carregar os dados')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole('table')).toHaveCount(0)
  await page.unroute('**/*.parquet')
  await page.getByRole('button', { name: 'Tentar de novo' }).click()
  await expect(page.getByRole('row', { name: /^Votos válidos/ })).toBeVisible({ timeout: 30_000 })
})

for (const [label, address] of [
  ['SQL text in the municipality', '/2026/secao/?uf=pe&mu=25313%3BDROP%20TABLE%20x&zn=3&se=597'],
  ['a slash in the state code', '/2026/municipio/?uf=pe%2F..%2Fsp&mu=25313'],
  ['a dot-dot state code', '/2026/municipio/?uf=..&mu=25313'],
  ['a zone out of range', '/2026/zona/?uf=pe&mu=25313&zn=10000'],
  ['an unknown race', '/2026/municipio/?uf=pe&mu=25313&cargo=prefeito'],
] as const) {
  test(`${label} shows the error state and requests no data`, async ({ page }) => {
    const requested: string[] = []
    page.on('request', (request) => {
      if (/\.(parquet|wasm)$|worker\.js$/.test(new URL(request.url()).pathname)) {
        requested.push(request.url())
      }
    })
    await page.goto(address)
    await expect(page.getByTestId('invalid-address')).toBeVisible()
    await page.waitForTimeout(500)
    expect(requested).toEqual([])
  })
}

test('switching language keeps the place and race', async ({ page }) => {
  await page.goto(STATION)
  await page.getByRole('link', { name: 'English' }).click()
  await expect(page).toHaveURL(/\/en\/2026\/secao\/\?uf=pe&mu=25313&zn=3&se=597&cargo=governador$/)
  await expect(page.getByRole('heading', { name: 'Station 597 · Zone 3 · RECIFE' })).toBeVisible()
})

test('a state page links to each of its municipalities', async ({ page }) => {
  await page.goto('/2026/pe/')
  await page.getByText('Ver os 3 municípios').click()
  await expect(page.getByRole('link', { name: 'FERNANDO DE NORONHA' })).toHaveAttribute(
    'href',
    '/2026/municipio/?uf=pe&mu=30015',
  )
})

test.describe('at 360 pixels wide', () => {
  test.use({ viewport: { width: 360, height: 740 } })

  for (const address of [STATION, MUNICIPALITY, '/2026/zona/?uf=pe&mu=25313&zn=3', NORONHA]) {
    test(`${address} needs no horizontal scrolling`, async ({ page }) => {
      await page.goto(address)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 })
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})
