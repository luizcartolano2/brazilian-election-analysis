import { expect, test } from '@playwright/test'
import { summary } from './fixtures'

test('switching language keeps the state page', async ({ page }) => {
  await page.goto('/2026/pe/')
  await page.getByRole('link', { name: 'English' }).click()
  await expect(page).toHaveURL(/\/en\/2026\/pe\/$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('link', { name: 'Português' }).click()
  await expect(page).toHaveURL(/\/2026\/pe\/$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
})

test('each language formats the same share its own way', async ({ page }) => {
  await page.goto('/2026/pe/governador/')
  const portuguese = await page.locator('tbody tr').first().locator('td').last().textContent()
  await page.goto('/en/2026/pe/governador/')
  const english = await page.locator('tbody tr').first().locator('td').last().textContent()
  expect(portuguese).toMatch(/^\d+,\d{2}%$/)
  expect(english).toBe(portuguese?.replace(',', '.'))
})

test('Brazil offers the state list for the state races, and marks the runoff', async ({ page }) => {
  await page.goto('/2026/')
  await expect(page.getByRole('heading', { name: 'Governador, Senado e deputados' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Pernambuco' })).toHaveAttribute('href', '/2026/pe/')
  await expect(page.getByText('2º turno', { exact: true })).toHaveCount(2)
  const response = await page.goto('/2026/br/governador/')
  expect(response?.status()).toBe(404)
})

test('the Senate page says each voter chose two candidates', async ({ page }) => {
  await page.goto('/2026/pe/senador/')
  await expect(page.getByText(/Cada eleitor escolheu dois candidatos/)).toBeVisible()
})

test('a deputy race shows party totals that add up to the valid votes', async ({ page }) => {
  await page.goto('/2026/pe/deputado-federal/')
  const race = summary('pe').corridas.find((entry) => entry.cargo === 6)
  const valid = new Intl.NumberFormat('pt-BR').format(race?.validos ?? -1)
  await expect(page.getByTestId('party-sum')).toContainText(`= ${valid} votos válidos`)
  const validRow = page.getByRole('row', { name: /^Votos válidos/ })
  await expect(validRow).toContainText(valid)
})

test('votes under appeal appear on their own lines', async ({ page }) => {
  await page.goto('/2026/pe/deputado-estadual/')
  await expect(page.getByRole('heading', { name: 'Votos sub judice' })).toBeVisible()
  await expect(page.getByText('Legenda do MOBILIZA')).toBeVisible()
})

test('every page credits TSE and the author, and sells nothing', async ({ page }) => {
  for (const address of ['/2026/pe/', '/en/2026/']) {
    await page.goto(address)
    const footer = page.locator('footer')
    await expect(footer).toContainText('TSE')
    await expect(footer).toContainText('Luiz Cartolano')
    await expect(
      footer.getByRole('link', { name: /Código e dados|Code and data/ }),
    ).toHaveAttribute('href', 'https://github.com/luizcartolano2/brazilian-election-analysis')
  }
})

test('the sources page shows the data version', async ({ page }) => {
  await page.goto('/2026/fontes/')
  await expect(page.getByTestId('data-version')).toBeVisible()
})
