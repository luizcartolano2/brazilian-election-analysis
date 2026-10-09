import { expect, test } from '@playwright/test'

test('the fonts come from the site, and the text shows without them', async ({ page }) => {
  const fonts: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'font') fonts.push(request.url())
  })
  await page.route('**/*.woff2', (route) => route.abort())
  await page.goto('/2026/')
  await page.evaluate(() => document.fonts.ready)
  expect(fonts.length).toBeGreaterThan(0)
  // The first family of the text and of a heading is the site's own font. The rest fall back.
  const statuses = await page.evaluate(() => {
    const unquote = (family: string) => family.trim().replace(/^["']|["']$/g, '')
    const own = [document.body, document.querySelector('h1')].map((element) =>
      unquote(getComputedStyle(element as Element).fontFamily.split(',')[0] ?? ''),
    )
    return [...document.fonts]
      .filter((face) => own.includes(unquote(face.family)))
      .map((face) => face.status)
  })
  expect(statuses).toEqual(['error', 'error'])
  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toBeVisible()
  expect((await heading.boundingBox())?.height).toBeGreaterThan(10)
})

test('the header offers both rounds with their dates, and marks the one shown', async ({
  page,
}) => {
  await page.goto('/2026/pe/')
  const rounds = page.getByTestId('round-switch').getByRole('link')
  await expect(rounds).toHaveText(['1º turno · 4 de outubro', '2º turno · 25 de outubro'])
  await expect(rounds.nth(0)).toHaveAttribute('aria-current', 'page')
  await expect(rounds.nth(1)).not.toHaveAttribute('aria-current')
  await expect(rounds.nth(0).locator('time')).toHaveAttribute('datetime', '2026-10-04')
  await expect(rounds.nth(1).locator('time')).toHaveAttribute('datetime', '2026-10-25')
  await page.goto('/en/2026/pe/')
  await expect(page.getByTestId('round-switch').getByRole('link')).toHaveText([
    'Round 1 · October 4',
    'Round 2 · October 25',
  ])
})

test('the header links to the state list', async ({ page }) => {
  await page.goto('/2026/pe/')
  await page.getByRole('banner').getByRole('link', { name: 'Estados' }).click()
  await expect(page).toHaveURL(/\/2026\/#estados$/)
  await expect(page.locator('#estados')).toBeInViewport()
})

test('cities abroad show in title case', async ({ page }) => {
  await page.goto('/2026/zz/')
  await page.getByText(/Ver as \d+ cidades/).click()
  await expect(page.getByRole('link', { name: 'Katmandu', exact: true })).toBeVisible()
})

test('a search typed in capitals finds a candidate shown in title case', async ({ page }) => {
  await page.goto('/2026/')
  await page.getByRole('combobox').click()
  await page.getByRole('combobox').fill('FLAVIO')
  await expect(page.getByRole('option', { name: /Flavio Bolsonaro/ })).toBeVisible()
})
