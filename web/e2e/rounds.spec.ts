import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { SHADES } from '../src/lib/map-colors'
import { builtRounds, elected } from './fixtures'

const DATA = path.join(import.meta.dirname, '..', '.data')

function readJson<T>(relative: string): T {
  return JSON.parse(readFileSync(path.join(DATA, relative), 'utf-8')) as T
}

// A build before the round-2 pin has round 1 only, and waiting.spec.ts tests it.
test.skip(!builtRounds().includes(2), 'this build has no round 2')

test('the fixture build holds round 2, marked as synthetic, beside round 1', () => {
  expect(readJson<{ rounds: number[] }>('source.json').rounds).toEqual([1, 2])
  const round2 = readJson<{ dataBase: string; synthetic: boolean }>('rounds/2/source.json')
  expect(round2).toMatchObject({ dataBase: '/_fixtures/data-t2', synthetic: true })
  expect(readJson<{ synthetic: boolean }>('rounds/1/source.json').synthetic).toBe(false)
  const acre = readJson<{ turno: number; corridas: { cargo: number }[] }>('rounds/2/resumo/ac.json')
  expect(acre.turno).toBe(2)
  expect(acre.corridas.map((race) => race.cargo)).toEqual([1, 3])
  expect(readJson<{ units: string[] }>('rounds/2/mapas/ac/3.json').units).toHaveLength(2)
})

test('every round-2 page says that the round is synthetic, in each language', async ({ page }) => {
  for (const address of [
    '/2026/segundo-turno/',
    '/2026/segundo-turno/ac/',
    '/2026/segundo-turno/ac/governador/',
    '/2026/segundo-turno/zz/',
    '/2026/segundo-turno/secao/?uf=ac&mu=1015&zn=2&se=87',
    '/2026/presidente/13/',
  ]) {
    await page.goto(address)
    await expect(page.getByTestId('fixtures-banner'), address).toContainText('2º turno é sintético')
  }
  await page.goto('/en/2026/segundo-turno/')
  await expect(page.getByTestId('fixtures-banner')).toContainText('this round 2 is synthetic')
  // Round-1 pages that show round 2's numbers say so too, and other round-1 pages do not.
  for (const address of ['/2026/', '/2026/fontes/']) {
    await page.goto(address)
    await expect(page.getByTestId('fixtures-banner'), address).toContainText('2º turno é sintético')
  }
  await expect(page.getByTestId('data-version')).toContainText('2º turno desta versão de teste')
  await page.goto('/2026/pe/')
  await expect(page.getByTestId('fixtures-banner')).not.toContainText('sintético')
})

test('the round-2 Brazil page leads with its winner, in each language, with no runoff date', async ({
  page,
}) => {
  const winner = elected('br', 1, 2)
  await page.goto('/2026/segundo-turno/')
  await expect(page.getByTestId('headline')).toHaveText(`${winner} vence no 2º turno`)
  await expect(page.getByTestId('result-card')).toHaveCount(2)
  await expect(page.getByTestId('result-cards')).not.toContainText('2º turno em')
  await expect(page.getByTestId('state-tiles')).toBeVisible()
  await page.goto('/en/2026/segundo-turno/')
  await expect(page.getByTestId('headline')).toHaveText(`${winner} wins the runoff`)
})

test('a finalist keeps its round-1 color in round 2, wherever it leads', async ({ page }) => {
  // Lula came second in round 1 across the fixture stations, and leads Pernambuco in round 2.
  await page.goto('/2026/segundo-turno/pe/')
  const first = page.getByTestId('result-card').first()
  await expect(first).toContainText('Lula')
  await expect(first.locator('span[aria-hidden="true"]').first()).toHaveAttribute(
    'style',
    new RegExp(`background:\\s*${SHADES[1][2]}`, 'i'),
  )
})

test('a state with a Governor runoff shows Governor first, each race with its own map', async ({
  page,
}) => {
  await page.goto('/2026/segundo-turno/ac/')
  await expect(page.getByRole('tab')).toHaveText(['Governador', 'Presidente'])
  await expect(page.locator('#governador [data-map="ac-governador"]')).toHaveCount(1)
  await expect(page.locator('#governador [data-testid="closest"]')).toHaveCount(1)
  await expect(page.locator('#presidente [data-map="ac-presidente"]')).toHaveCount(1)
  await expect(page.locator('#presidente [data-testid="closest"]')).toHaveCount(0)
  const governor = page.locator('#governador').getByTestId('race-map')
  await governor.scrollIntoViewIfNeeded()
  await expect(governor.locator('svg')).toBeVisible()
  await expect(governor.locator('xpath=ancestor::figure')).toContainText('· 2º turno')
})

test('a state with President only shows no tabs, and an area with one municipality no map', async ({
  page,
}) => {
  await page.goto('/2026/segundo-turno/pe/')
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.locator('[data-map="pe-presidente"]')).toHaveCount(1)
  await page.goto('/2026/segundo-turno/se/')
  await expect(page.getByTestId('headline')).toBeVisible()
  await expect(page.locator('[data-map]')).toHaveCount(0)
})

test('the round-2 race and abroad pages show round 2', async ({ page }) => {
  await page.goto('/2026/segundo-turno/ac/governador/')
  await expect(page.getByTestId('headline')).toHaveText(`${elected('ac', 3, 2)} vence no 2º turno`)
  await expect(page.getByTestId('result-card')).toHaveCount(2)
  await page.goto('/2026/segundo-turno/zz/')
  await expect(page.getByTestId('headline')).toHaveText(`${elected('zz', 1, 2)} vence no 2º turno`)
})

test('a round-2 station view reads round 2, and links to TSE under its election', async ({
  page,
}) => {
  await page.goto('/2026/segundo-turno/secao/?uf=ac&mu=1015&zn=2&se=87&cargo=governador')
  await expect(page.getByTestId('tse-link')).toHaveAttribute('href', /\?e=6260&uf=ac/, {
    timeout: 30_000,
  })
  await expect(page.getByRole('row', { name: /^Votos válidos/ })).toBeVisible()
  await page.goto('/2026/segundo-turno/zona/?uf=ac&mu=1015&zn=2')
  await expect(
    page.locator('a[href^="/2026/segundo-turno/secao/?uf=ac&mu=1015&zn=2"]').first(),
  ).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.locator('header + div a[href^="/2026/secao/"]')).toHaveCount(0)
})

test('a round-2 municipality view reads round 2, and links down within round 2', async ({
  page,
}) => {
  await page.goto('/2026/segundo-turno/municipio/?uf=ac&mu=1015&cargo=governador')
  await expect(page.getByRole('row', { name: /^Votos válidos/ })).toBeVisible({ timeout: 30_000 })
  await expect(
    page.locator('header + div a[href^="/2026/segundo-turno/zona/?uf=ac&mu=1015"]').first(),
  ).toBeVisible()
  await expect(page.locator('header + div a[href^="/2026/zona/"]')).toHaveCount(0)
})

test('the header switch leads to the same page in the other round', async ({ page }) => {
  const switchTo = (round: 1 | 2) =>
    page
      .getByTestId('round-switch')
      .getByRole('link')
      .nth(round - 1)
  await page.goto('/2026/ac/')
  await switchTo(2).click()
  await expect(page).toHaveURL(/\/2026\/segundo-turno\/ac\/$/)
  await expect(switchTo(2)).toHaveAttribute('aria-current', 'page')
  await expect(switchTo(1)).toHaveAttribute('href', '/2026/ac/')

  await page.goto('/2026/pe/senador/')
  await expect(switchTo(2)).toHaveAttribute('href', '/2026/segundo-turno/pe/')
  await page.goto('/en/2026/ac/governador/')
  await expect(switchTo(2)).toHaveAttribute('href', '/en/2026/segundo-turno/ac/governador/')

  await page.goto('/2026/fontes/')
  await expect(switchTo(1)).toHaveAttribute('href', '/2026/')
  await expect(switchTo(2)).toHaveAttribute('href', '/2026/segundo-turno/')
  await expect(page.locator('[data-testid="round-switch"] [aria-current]')).toHaveCount(0)

  await page.goto('/2026/secao/?uf=pe&mu=25313&zn=3&se=597&cargo=senador')
  await expect(switchTo(2)).toHaveAttribute(
    'href',
    '/2026/segundo-turno/secao/?uf=pe&mu=25313&zn=3&se=597',
  )
  // The round shown keeps the place too, so following it does not lose the view.
  await expect(switchTo(1)).toHaveAttribute(
    'href',
    '/2026/secao/?uf=pe&mu=25313&zn=3&se=597&cargo=senador',
  )
  await expect(switchTo(1)).toHaveAttribute('aria-current', 'page')
})

test('a finalist page leads with round 2, and the switch leads to its round sections', async ({
  page,
}) => {
  await page.goto('/2026/presidente/13/')
  await expect(page.locator('section[data-testid^="round-"]')).toHaveCount(2)
  await expect(
    page.locator('section[data-testid="round-2"] + section[data-testid="round-1"]'),
  ).toHaveCount(1)
  await expect(page.getByTestId('headline')).toHaveText('Termina em 2º lugar')
  const switchLinks = page.getByTestId('round-switch').getByRole('link')
  await expect(switchLinks.nth(0)).toHaveAttribute('href', '/2026/presidente/13/#turno-1')
  await expect(switchLinks.nth(1)).toHaveAttribute('href', '/2026/presidente/13/#turno-2')
  await expect(page.locator('[data-testid="round-switch"] [aria-current]')).toHaveCount(0)

  const runoff = page.getByTestId('round-2')
  await expect(runoff.getByTestId('states-led')).toBeVisible()
  const states = runoff.getByTestId('state-shares').locator('tbody tr a')
  await expect(states).toHaveCount(3)
  for (const href of await states.evaluateAll((links) =>
    links.map((link) => link.getAttribute('href')),
  )) {
    expect(href).toMatch(/^\/2026\/segundo-turno\/(ac|pe|se)\/$/)
  }
  await expect(runoff.getByTestId('race-map')).toHaveCount(1)
})

test('a candidate eliminated in round 1 shows round 1 only', async ({ page }) => {
  await page.goto('/2026/presidente/70/')
  await expect(page.locator('section[data-testid^="round-"]')).toHaveCount(0)
  await expect(page.getByTestId('round-switch').getByRole('link').nth(1)).toHaveAttribute(
    'href',
    '/2026/segundo-turno/',
  )
})

test('the round-1 Brazil page leads to round 2 with its headline', async ({ page }) => {
  await page.goto('/2026/')
  const card = page.getByTestId('runoff-card')
  await expect(card).toContainText(`${elected('br', 1, 2)} vence no 2º turno`)
  await expect(card.getByRole('link')).toHaveAttribute('href', '/2026/segundo-turno/')
  const order = await page.evaluate(() => {
    const top = (selector: string) =>
      document.querySelector(selector)?.getBoundingClientRect().top ?? Number.NaN
    return { cards: top('[data-testid="result-cards"]'), card: top('[data-testid="runoff-card"]') }
  })
  expect(order.cards).toBeLessThan(order.card)
})
