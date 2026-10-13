import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

const RECIFE_IBGE = '2611606'

/** The address of the first values file that a page asks for, once the page has loaded. */
function valuesRequests(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/mapas/')) urls.push(url.pathname)
  })
  return urls
}

test('each round’s Brazil page carries its map’s file, and no municipality’s values', async ({
  request,
  page,
}) => {
  for (const [address, round] of [
    ['/2026/', 1],
    ['/2026/segundo-turno/', 2],
  ] as const) {
    const html = await (await request.get(address)).text()
    expect(html, address).toMatch(new RegExp(`/mapas/t${round}/br/1\\.[0-9a-f]{16}\\.json`))
    expect(html, address).not.toContain(RECIFE_IBGE)
    const file = /\/mapas\/t[12]\/br\/1\.[0-9a-f]{16}\.json/.exec(html)?.[0] as string
    const bytes = await (await request.get(file)).body()
    expect(html, address).toContain(createHash('sha256').update(bytes).digest('hex'))
    await page.goto(address)
    const map = page.getByTestId('race-map').first()
    await map.scrollIntoViewIfNeeded()
    await expect(map.locator(`path[data-ibge="${RECIFE_IBGE}"]`)).toBeVisible()
  }
})

test('a click on the Brazil map opens the municipality’s view', async ({ page }) => {
  await page.goto('/2026/')
  const map = page.getByTestId('race-map').first()
  await map.scrollIntoViewIfNeeded()
  await map.locator(`path[data-ibge="${RECIFE_IBGE}"]`).click()
  await expect(page).toHaveURL(/\/2026\/municipio\/\?uf=pe&mu=25313&cargo=presidente$/)
})

test('a candidate page without JavaScript keeps its results and says what needs it', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/2026/presidente/70/')
  await expect(page.getByTestId('headline')).toBeVisible()
  await expect(page.getByTestId('largest')).toBeVisible()
  await expect(page.getByTestId('state-shares')).toBeVisible()
  // Playwright turns scripts off without telling the HTML parser, so the test reads the text.
  expect(await page.getByTestId('race-map').locator('noscript').innerHTML()).toBe(
    'O mapa e a lista de municípios precisam de JavaScript.',
  )
  await expect(page.getByTestId('municipality-table')).toHaveCount(0)
  await context.close()
})

test('a values file that fails its check shows no map and no list, and a retry reloads it', async ({
  page,
}) => {
  let first = true
  // Records the cache mode of each values request, which the network layer does not show.
  await page.addInitScript(() => {
    const original = window.fetch
    const modes: string[] = []
    Object.assign(window, { __valuesCacheModes: modes })
    window.fetch = (input, init) => {
      if (String(input).includes('/mapas/')) modes.push(init?.cache ?? 'default')
      return original(input, init)
    }
  })
  await page.route('**/mapas/t1/pe/3-votos.*.json', async (route) => {
    if (first) {
      first = false
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"numbers":[]}' })
      return
    }
    await route.continue()
  })
  await page.goto('/2026/pe/governador/55/')
  const map = page.getByTestId('race-map').first()
  await expect(map.getByRole('alert')).toHaveText('Os números do mapa não carregaram.')
  await expect(map.locator('svg')).toHaveCount(0)
  await page.getByTestId('municipality-list').locator('summary').click()
  await expect(page.getByTestId('municipality-table')).toHaveCount(0)
  await map.getByRole('button', { name: 'Tentar de novo' }).click()
  await map.scrollIntoViewIfNeeded()
  await expect(map.locator('svg')).toBeVisible()
  await expect(page.getByTestId('municipality-table')).toBeVisible()
  // The retry asks the site again, past the browser's cache.
  expect(
    await page.evaluate(
      () => (window as unknown as { __valuesCacheModes: string[] }).__valuesCacheModes,
    ),
  ).toEqual(['default', 'reload'])
})

test('a values file gone after a deploy offers to reload the page', async ({ page }) => {
  await page.route('**/mapas/t1/pe/3-votos.*.json', (route) => route.fulfill({ status: 404 }))
  await page.goto('/2026/pe/governador/55/')
  const map = page.getByTestId('race-map').first()
  await expect(map.getByRole('alert')).toHaveText(
    'O site foi atualizado desde que esta página abriu.',
  )
  await expect(map.getByRole('button', { name: 'Recarregar a página' })).toBeVisible()
})

test('a candidate’s list is complete before its boundary file arrives', async ({ page }) => {
  // The boundary request never answers, so only the values file reaches the page.
  await page.route('**/_fixtures/geo/pe.json', () => new Promise(() => {}))
  await page.goto('/2026/pe/governador/55/')
  const list = page.getByTestId('municipality-list')
  await expect(list.locator('summary')).toHaveText('Lista dos 3 municípios')
  await list.locator('summary').click()
  await expect(page.getByTestId('municipality-table').locator('tbody tr')).toHaveCount(3)
  await expect(page.getByTestId('race-map').first().locator('svg')).toHaveCount(0)
})

test('a candidate’s list sorts by share', async ({ page }) => {
  await page.goto('/2026/pe/governador/55/')
  await page.getByTestId('municipality-list').locator('summary').click()
  await page.getByRole('button', { name: 'Pela parcela' }).click()
  const shares = await page
    .getByTestId('municipality-table')
    .locator('tbody tr td:last-child')
    .allTextContents()
  const values = shares.map((text) => Number(text.replace('%', '').replace(',', '.')))
  expect(values).toEqual([...values].sort((a, b) => b - a))
})

test('moving from one candidate to another shows the second candidate’s map', async ({ page }) => {
  await page.goto('/2026/presidente/70/')
  await page.getByTestId('municipality-list').locator('summary').first().click()
  await expect(page.getByTestId('municipality-table').first()).toContainText(
    'Escritor Augusto Cury',
  )
  await page.getByRole('combobox').fill('renan')
  await page.getByRole('option').first().click()
  await expect(page).toHaveURL(/\/2026\/presidente\/14\/$/)
  await page.getByTestId('municipality-list').locator('summary').first().click()
  const caption = page.getByTestId('municipality-table').first().locator('caption')
  await expect(caption).toContainText('Renan Santos')
  await expect(caption).not.toContainText('Augusto Cury')
})

test('a candidacy under appeal requests no values file', async ({ page }) => {
  const urls = valuesRequests(page)
  await page.goto('/2026/ac/senador/111/')
  await page.waitForLoadState('networkidle')
  expect(urls).toEqual([])
})

test('a finalist’s page loads one values file for each round', async ({ page }) => {
  const urls = valuesRequests(page)
  await page.goto('/2026/presidente/13/')
  await page.waitForLoadState('networkidle')
  expect(urls.sort()).toEqual([
    expect.stringMatching(/^\/mapas\/t1\/br\/1-votos\./),
    expect.stringMatching(/^\/mapas\/t2\/br\/1-votos\./),
  ])
  await expect(page.getByTestId('municipality-list')).toHaveCount(2)
})

test('client navigation never asks for a navigation file that the build deleted', async ({
  page,
}) => {
  const missing: string[] = []
  page.on('response', (response) => {
    if (response.url().includes('.txt') && response.status() === 404) missing.push(response.url())
  })
  await page.goto('/2026/')
  await page.getByTestId('state-tiles').locator('a[data-state="pe"]').click()
  await expect(page).toHaveURL(/\/2026\/pe\/$/)
  await page.locator('#governador a[href="/2026/pe/governador/"]').click()
  await expect(page).toHaveURL(/\/2026\/pe\/governador\/$/)
  await page.getByTestId('result-card').first().getByRole('link').first().click()
  await expect(page).toHaveURL(/\/2026\/pe\/governador\/\d+\/$/)
  await page.getByTestId('largest').locator('a').first().click()
  await expect(page).toHaveURL(/\/2026\/municipio\//)
  await page.getByRole('link', { name: 'Brasil' }).first().click()
  await expect(page).toHaveURL(/\/2026\/$/)
  expect(missing).toEqual([])
})
