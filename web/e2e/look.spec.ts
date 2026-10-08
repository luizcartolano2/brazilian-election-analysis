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
  // next/font adds a fallback face for each font, drawn from a local system font.
  const faces = await page.evaluate(() =>
    [...document.fonts].map((face) => ({ family: face.family, status: face.status })),
  )
  const own = faces.filter((face) => !face.family.includes('Fallback'))
  const fallback = faces.filter((face) => face.family.includes('Fallback'))
  expect(own.map((face) => face.status)).toEqual(['error', 'error'])
  expect(fallback.length).toBe(2)
  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toBeVisible()
  expect((await heading.boundingBox())?.height).toBeGreaterThan(10)
})

test('the header names the round and its date in each language', async ({ page }) => {
  await page.goto('/2026/pe/')
  const header = page.getByRole('banner')
  await expect(header).toContainText('1º turno · 4 de outubro de 2026')
  await expect(header.locator('time')).toHaveAttribute('datetime', '2026-10-04')
  await page.goto('/en/2026/pe/')
  await expect(page.getByRole('banner')).toContainText('Round 1 · October 4, 2026')
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
