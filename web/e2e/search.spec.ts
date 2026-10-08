import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __violations: string[]
  }
}

function searchBox(page: Page) {
  return page.getByRole('combobox')
}

async function type(page: Page, text: string) {
  await searchBox(page).click()
  await searchBox(page).fill(text)
  await expect(page.getByRole('listbox')).toBeVisible()
}

test('a page load requests no search index, and the first focus does', async ({ page }) => {
  const requested: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/busca/')) requested.push(request.url())
  })
  await page.goto('/2026/pe/')
  await page.waitForLoadState('networkidle')
  expect(requested).toEqual([])
  await searchBox(page).click()
  await page.waitForLoadState('networkidle')
  expect(requested).toHaveLength(2)
})

test('the box keeps its place before the scripts run', async ({ page }) => {
  await page.route('**/*', (route) =>
    route.request().resourceType() === 'script' ? route.abort() : route.fallback(),
  )
  await page.goto('/2026/pe/')
  const before = await page.locator('main').boundingBox()
  await page.unrouteAll()
  await page.goto('/2026/pe/')
  await expect(searchBox(page)).toBeVisible()
  const after = await page.locator('main').boundingBox()
  expect(after?.y).toBe(before?.y)
})

test('the down arrow twice and Enter open the second result', async ({ page }) => {
  await page.goto('/2026/fontes/')
  await type(page, 're')
  const second = await page.getByRole('option').nth(1).getAttribute('data-href')
  expect(second).toBeTruthy()
  await searchBox(page).press('ArrowDown')
  await searchBox(page).press('ArrowDown')
  await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true')
  await searchBox(page).press('Enter')
  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}${url.hash}` === second)
})

test('Escape closes the list', async ({ page }) => {
  await page.goto('/2026/')
  await type(page, 'recife')
  await expect(searchBox(page)).toHaveAttribute('aria-controls', /list/)
  await searchBox(page).press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(searchBox(page)).toHaveAttribute('aria-expanded', 'false')
  await expect(searchBox(page)).not.toHaveAttribute('aria-controls')
})

test('the up arrow on a closed list selects nothing, so the down arrow opens on the first result', async ({
  page,
}) => {
  await page.goto('/2026/')
  await type(page, 're')
  await searchBox(page).press('Escape')
  await searchBox(page).press('ArrowUp')
  await searchBox(page).press('ArrowDown')
  await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true')
})

test('the arrow keys keep the active result in view', async ({ page }) => {
  await page.goto('/2026/')
  await type(page, 'da')
  await expect(page.getByRole('option')).toHaveCount(20)
  for (let step = 0; step < 20; step++) await searchBox(page).press('ArrowDown')
  await expect(page.getByRole('option').last()).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('option').last()).toBeInViewport()
})

test('a press on the note under the results keeps the list open', async ({ page }) => {
  await page.goto('/2026/')
  await type(page, 'da')
  await page
    .getByTestId('site-search')
    .getByRole('paragraph')
    .filter({ hasText: 'Há mais de 20 resultados' })
    .hover()
  await page.mouse.down()
  await page.mouse.up()
  await expect(page.getByRole('listbox')).toBeVisible()
  await expect(searchBox(page)).toBeFocused()
})

test('an index that fails to load says so, and a click on the box tries again', async ({
  page,
}) => {
  const failed = 'A busca não carregou. Clique na caixa para tentar de novo.'
  await page.route('**/busca/**', (route) => route.abort())
  await page.goto('/2026/')
  await searchBox(page).click()
  await expect(page.getByTestId('site-search').getByRole('status')).toHaveText(failed)
  const message = page.getByTestId('site-search').getByRole('paragraph').filter({ hasText: failed })
  await expect(message).toBeVisible()
  await page.unroute('**/busca/**')
  await searchBox(page).click()
  await expect(message).toHaveCount(0)
  await searchBox(page).fill('recife')
  await expect(page.getByRole('option', { name: /^Recife/ })).toBeVisible()
})

test('the result count is announced', async ({ page }) => {
  await page.goto('/2026/')
  await type(page, 'recife')
  await expect(page.getByTestId('site-search').getByRole('status')).toHaveText(
    /^\d+ resultados?\.$/,
  )
  await searchBox(page).fill('zzzz')
  await expect(page.getByTestId('site-search').getByRole('status')).toHaveText('Nenhum resultado.')
})

test('an English page names the race in English', async ({ page }) => {
  await page.goto('/en/2026/')
  await type(page, 'humberto')
  const senator = page.getByRole('option', { name: /Humberto Costa/ })
  await expect(senator).toContainText('Senator')
  await expect(senator).toContainText('Pernambuco')
  await expect(senator).toContainText('Elected')
  await searchBox(page).fill('katmandu')
  await expect(page.getByRole('option', { name: /Katmandu/ })).toContainText('Abroad')
})

test('each President candidacy appears once', async ({ page }) => {
  await page.goto('/2026/')
  await type(page, 'lula')
  await expect(page.getByRole('option', { name: /^Lula PT · 13/ })).toHaveCount(1)
})

test('without JavaScript no search box shows, and the Brazil page is a click away', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/2026/pe/senador/')
  await expect(page.getByRole('combobox')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Eleições 2026' })).toHaveAttribute('href', '/2026/')
  await context.close()
})

for (const [label, query, option, address, row] of [
  ['a municipality', 'recife', /^Recife/, '/2026/municipio/?uf=pe&mu=25313', null],
  ['a city abroad', 'katmandu', /^Katmandu/, '/2026/municipio/?uf=zz&mu=29173', null],
  ['a President candidacy', 'lula', /^Lula PT · 13/, '/2026/presidente/13/', null],
  ['a Governor candidacy', 'raquel lyra', /^Raquel Lyra/, '/2026/pe/governador/55/', null],
  ['a Senate candidacy', 'humberto', /^Humberto Costa/, '/2026/pe/senador/130/', null],
  [
    'a deputy candidacy',
    'abimael',
    /^Abimael Santos/,
    '/2026/pe/deputado-estadual/#candidato-22622',
    'candidato-22622',
  ],
] as const) {
  test(`${label} opens its place`, async ({ page }) => {
    await page.goto('/2026/fontes/')
    await type(page, query)
    await page.getByRole('option', { name: option }).first().click()
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}${url.hash}` === address)
    if (row !== null) await expect(page.locator(`#${row}`)).toBeInViewport()
  })
}

test.describe('with the list open', () => {
  test('at 360 pixels wide, the page needs no horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/2026/pe/')
    await type(page, 'santos')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('under the production headers, with no policy violation', async ({ page }) => {
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
    await page.goto('/en/2026/se/')
    const index = page.waitForResponse((response) => response.url().endsWith('/candidatos.json'))
    await type(page, 'santos')
    const response = await index
    expect(new URL(response.url()).origin).toBe(new URL(page.url()).origin)
    expect(response.headers()['cache-control']).toBe('public, max-age=31536000, immutable')
    expect(await page.evaluate(() => window.__violations)).toEqual([])
    expect(errors).toEqual([])
  })
})
