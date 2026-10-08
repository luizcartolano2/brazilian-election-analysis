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
  await searchBox(page).focus()
  await expect.poll(() => requested.length).toBe(2)
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
  await searchBox(page).press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(searchBox(page)).toHaveAttribute('aria-expanded', 'false')
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
  await expect(page.getByRole('option', { name: /HUMBERTO COSTA/ })).toContainText('Senator')
  await expect(page.getByRole('option', { name: /HUMBERTO COSTA/ })).toContainText('Pernambuco')
})

test('each President candidacy appears once', async ({ page }) => {
  await page.goto('/2026/')
  await type(page, 'lula')
  await expect(page.getByRole('option', { name: /^LULA PT · 13/ })).toHaveCount(1)
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
  ['a municipality', 'recife', /^RECIFE/, '/2026/municipio/?uf=pe&mu=25313', null],
  ['a city abroad', 'katmandu', /^KATMANDU/, '/2026/municipio/?uf=zz&mu=29173', null],
  ['a President candidacy', 'lula', /^LULA PT · 13/, '/2026/#candidato-13', 'candidato-13'],
  [
    'a Governor candidacy',
    'raquel lyra',
    /^RAQUEL LYRA/,
    '/2026/pe/governador/#candidato-55',
    'candidato-55',
  ],
  [
    'a Senate candidacy',
    'humberto',
    /^HUMBERTO COSTA/,
    '/2026/pe/senador/#candidato-130',
    'candidato-130',
  ],
  [
    'a deputy candidacy',
    'abimael',
    /^ABIMAEL SANTOS/,
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
    expect((await index).headers()['cache-control']).toBe('public, max-age=31536000, immutable')
    expect(await page.evaluate(() => window.__violations)).toEqual([])
    expect(errors).toEqual([])
  })
})
