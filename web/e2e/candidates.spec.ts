import { expect, test, type Page } from '@playwright/test'
import { summary } from './fixtures'

const MAJORITARIAN = { governador: 3, senador: 5 }

/** Every President, Governor and Senate candidacy in the fixtures, as Portuguese addresses. */
function candidateAddresses(): string[] {
  const president = summary('br').corridas.find((race) => race.cargo === 1)
  const addresses = (president?.candidatos ?? []).map(
    (candidate) => `/2026/presidente/${candidate.numero}/`,
  )
  for (const area of ['ac', 'pe', 'se']) {
    for (const [slug, cargo] of Object.entries(MAJORITARIAN)) {
      const race = summary(area).corridas.find((entry) => entry.cargo === cargo)
      for (const candidate of race?.candidatos ?? []) {
        addresses.push(`/2026/${area}/${slug}/${candidate.numero}/`)
      }
    }
  }
  return addresses
}

async function drawnMap(page: Page, address: string) {
  await page.goto(address)
  const map = page.getByTestId('race-map').first()
  await map.scrollIntoViewIfNeeded()
  await expect(map.locator('svg')).toBeVisible()
  return map
}

test('each majoritarian candidacy has a page in each language', async ({ request }) => {
  const addresses = candidateAddresses()
  expect(addresses.length).toBeGreaterThan(40)
  for (const address of addresses) {
    for (const localized of [address, `/en${address}`]) {
      const response = await request.get(localized)
      expect(response.status(), localized).toBe(200)
    }
  }
})

test("a page's address opens the same candidate in a new browser", async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/2026/pe/senador/130/')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('HUMBERTO COSTA')
  await expect(page.getByText('PT · 130 · Senador · Pernambuco')).toBeVisible()
  await context.close()
})

test('a Governor candidate shows votes, share and outcome, a share map and a list', async ({
  page,
}) => {
  const map = await drawnMap(page, '/2026/pe/governador/55/')
  const race = summary('pe').corridas.find((entry) => entry.cargo === 3)
  const candidate = race?.candidatos.find((entry) => entry.numero === 55)
  const votes = new Intl.NumberFormat('pt-BR').format(candidate?.votos ?? -1)

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('RAQUEL LYRA')
  await expect(page.getByTestId('candidate-votes')).toHaveText(votes)
  await expect(page.getByText('Parcela dos válidos')).toBeVisible()
  await expect(page.getByText(candidate?.resultado ?? '?', { exact: true }).first()).toBeVisible()
  await expect(map.locator('svg path[data-ibge]')).toHaveCount(3)
  const frame = map.locator('xpath=ancestor::figure')
  await expect(frame).toContainText('RAQUEL LYRA · Governador · Pernambuco · 1º turno')
  await expect(frame).toContainText('de 0 a 10%')
  await expect(frame).toContainText('50% ou mais')
  await expect(page.getByTestId('municipality-table').locator('tbody tr')).toHaveCount(3)
})

test('a President candidate maps every state, and lists municipalities by state', async ({
  page,
}) => {
  const map = await drawnMap(page, '/2026/presidente/13/')

  await expect(map.locator('svg path[data-ibge]')).toHaveCount(8)
  await expect(page.getByText('Pernambuco · 3')).toBeVisible()
  await page.getByText('Pernambuco · 3').click()
  await expect(
    page.getByTestId('municipality-table').getByRole('link', { name: 'RECIFE' }),
  ).toHaveAttribute('href', '/2026/municipio/?uf=pe&mu=25313&cargo=presidente')
})

test('a Senate candidate maps in steps of 5 points, and says that each voter chose two', async ({
  page,
}) => {
  const map = await drawnMap(page, '/2026/pe/senador/130/')
  const frame = map.locator('xpath=ancestor::figure')

  await expect(frame).toContainText('de 0 a 5%')
  await expect(frame).toContainText('25% ou mais')
  await expect(frame).toContainText('Cada eleitor escolheu dois candidatos para duas vagas')
})

test('a candidacy under appeal shows its votes as under appeal, and no share map', async ({
  page,
}) => {
  await page.goto('/2026/pe/senador/355/')

  await expect(page.getByTestId('under-appeal')).toContainText('Anulado sub judice')
  await expect(page.getByText('Parcela dos válidos')).toHaveCount(0)
  await expect(page.getByTestId('race-map')).toHaveCount(0)
})

test('a candidate in an area with one municipality gets no share map', async ({ page }) => {
  await page.goto('/2026/se/governador/55/')

  await expect(page.getByText('Esta disputa tem um único município')).toBeVisible()
  await expect(page.getByTestId('race-map')).toHaveCount(0)
})

for (const [label, address, name, target] of [
  ['the Brazil page', '/2026/', 'LULA', '/2026/presidente/13/'],
  ['a Governor race page', '/2026/pe/governador/', 'RAQUEL LYRA', '/2026/pe/governador/55/'],
  ['a Senate race page', '/2026/pe/senador/', 'HUMBERTO COSTA', '/2026/pe/senador/130/'],
] as const) {
  test(`${label} links each candidate to their page`, async ({ page }) => {
    await page.goto(address)
    await page.getByRole('link', { name, exact: true }).first().click()

    await expect(page).toHaveURL(target)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
  })
}

test('a deputy race keeps its candidates without links', async ({ page }) => {
  await page.goto('/2026/pe/deputado-federal/')

  await expect(page.getByRole('link', { name: 'PEDRO CAMPOS', exact: true })).toHaveCount(0)
})

test('switching language keeps the candidate page', async ({ page }) => {
  await page.goto('/2026/pe/senador/130/')
  await page.getByRole('link', { name: 'English' }).click()

  await expect(page).toHaveURL('/en/2026/pe/senador/130/')
  await expect(page.getByText('PT · 130 · Senator · Pernambuco')).toBeVisible()
})
