import { expect, test } from '@playwright/test'
import { builtRounds } from './fixtures'

// Runs on a fixtures build made with ELEICOES_FIXTURE_ROUNDS=1, as a build before the pin.
test.skip(builtRounds().includes(2), 'this build holds round 2')

test('every round-2 page states the date and shows no result', async ({ page }) => {
  for (const address of [
    '/2026/segundo-turno/',
    '/2026/segundo-turno/pe/',
    '/2026/segundo-turno/zz/',
    '/2026/segundo-turno/pe/presidente/',
    '/2026/segundo-turno/municipio/?uf=pe&mu=25313',
  ]) {
    await page.goto(address)
    const waiting = page.getByTestId('waiting')
    await expect(waiting, address).toContainText('2º turno em 25 de outubro de 2026')
    await expect(waiting, address).toContainText('assim que o TSE publicar')
    const main = page.locator('header + div')
    await expect(main.getByTestId('result-card'), address).toHaveCount(0)
    await expect(main.locator('table, [data-map]'), address).toHaveCount(0)
    expect(await main.innerText(), address).not.toMatch(/%/)
  }
  await page.goto('/en/2026/segundo-turno/')
  await expect(page.getByTestId('waiting')).toContainText('Runoff on October 25, 2026')
})

test('a race with no known runoff has no round-2 page yet', async ({ request }) => {
  expect((await request.get('/2026/segundo-turno/ac/governador/')).status()).toBe(404)
  expect((await request.get('/2026/segundo-turno/pe/presidente/')).status()).toBe(200)
})

test('the round-2 station view requests no data', async ({ page }) => {
  const requested: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('/_fixtures/') || url.includes('.parquet') || url.includes('duckdb')) {
      requested.push(url)
    }
  })
  await page.goto('/2026/segundo-turno/secao/?uf=pe&mu=25313&zn=3&se=597')
  await expect(page.getByTestId('waiting')).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(requested).toEqual([])
})

test('round 1 leads to the waiting page, and a finalist page shows round 1 only', async ({
  page,
}) => {
  await page.goto('/2026/')
  const card = page.getByTestId('runoff-card')
  await expect(card).toContainText('2º turno · 25 de outubro de 2026')
  await expect(card).toContainText('assim que o TSE publicar')
  await expect(card.getByRole('link')).toHaveAttribute('href', '/2026/segundo-turno/')
  await page.goto('/2026/ac/governador/11/')
  await expect(page.locator('section[data-testid^="round-"]')).toHaveCount(0)
  await expect(page.getByTestId('round-switch').getByRole('link').nth(1)).toHaveAttribute(
    'href',
    '/2026/segundo-turno/ac/',
  )
})

test('a waiting page needs no horizontal scrolling at 360 pixels wide', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  for (const address of ['/2026/segundo-turno/', '/en/2026/segundo-turno/pe/presidente/']) {
    await page.goto(address)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, address).toBeLessThanOrEqual(0)
  }
})
