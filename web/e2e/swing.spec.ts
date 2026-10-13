import { existsSync, readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const RECIFE = '2611606'
const LULA = '/2026/presidente/13/'
const FLAVIO = '/2026/presidente/22/'

function readData<T>(relative: string): T {
  return JSON.parse(readFileSync(`.data/${relative}`, 'utf-8')) as T
}

// CI's fixture build sets ELEICOES_FIXTURE_SWING=1, which draws the swing over the synthetic
// round 2. A build without it, or without round 2, shows no swing map.
const hasRound2 = existsSync('.data/rounds/2/source.json')
const synthetic = hasRound2 && readData<{ synthetic: boolean }>('rounds/2/source.json').synthetic
const allowed = readData<{ syntheticAllowed: boolean }>('swing.json').syntheticAllowed
test.skip(!hasRound2, 'the build has no round 2')
test.skip(synthetic && !allowed, 'the build shows no swing map: set ELEICOES_FIXTURE_SWING=1')

function swingSection(page: Page) {
  return page.locator('[data-map="br-presidente-variacao"]')
}

/** Each row's swing, keyed by the TSE code in its link, since names repeat across states. */
async function swingRows(page: Page): Promise<Map<string, string>> {
  const section = swingSection(page)
  await section.locator('summary').first().click()
  await expect(section.getByTestId('municipality-table').first()).toBeAttached()
  const rows = await section.locator('tbody tr').evaluateAll((elements) =>
    elements.map((row) => {
      const href = row.querySelector('a')?.getAttribute('href') ?? ''
      const cells = [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '')
      return [new URL(href, 'http://x').searchParams.get('mu') ?? '', cells[3] ?? '']
    }),
  )
  return new Map(rows.map(([code, change]) => [code ?? '', change ?? '']))
}

test('a finalist’s round-2 section shows the swing map below its round-2 share map', async ({
  page,
}) => {
  await page.goto(LULA)
  const round2 = page.getByTestId('round-2')
  const maps = await round2
    .locator('[data-map]')
    .evaluateAll((sections) => sections.map((section) => section.getAttribute('data-map')))
  expect(maps).toEqual(['br-presidente', 'br-presidente-variacao'])
  const order = await round2.evaluate((section) =>
    ['[data-map="br-presidente"]', '[data-testid="abroad-note"]', '[data-map$="-variacao"]'].map(
      (selector) =>
        [...section.querySelectorAll('*')].indexOf(section.querySelector(selector) as Element),
    ),
  )
  expect(order).toEqual([...order].sort((a, b) => a - b))
  await expect(page.getByTestId('round-1').locator('[data-map$="-variacao"]')).toHaveCount(0)
})

test('the frame names what it compares, its race, area and rounds, and both credits', async ({
  page,
}) => {
  await page.goto(LULA)
  const frame = swingSection(page).locator('figure')
  await frame.scrollIntoViewIfNeeded()
  const caption = frame.locator('figcaption')
  await expect(caption).toContainText('Lula · Presidente · Brasil · do 1º ao 2º turno')
  await expect(caption).toContainText(
    'O mapa compara duas contagens oficiais dos votos dos dois finalistas.',
  )
  await expect(caption).toContainText('os arquivos do TSE não permitem separá-los')
  await expect(caption).toContainText('O mapa não mostra para onde foi o voto de nenhum eleitor.')
  for (const step of [
    '−6 p.p. ou menos',
    'de −6 a −3 p.p.',
    'de −3 a −1 p.p.',
    'de −1 a +1 p.p.',
    'de +1 a +3 p.p.',
    'de +3 a +6 p.p.',
    '+6 p.p. ou mais',
  ]) {
    await expect(caption.locator('li', { hasText: step })).toHaveCount(1)
  }
  await expect(
    caption.locator('li', { hasText: 'Sem votos para os finalistas em um dos turnos' }),
  ).toHaveCount(1)
  await expect(caption).toContainText('O mapa deixa de fora os votos no exterior.')
  await expect(caption).toContainText('Tribunal Superior Eleitoral')
  await expect(caption).toContainText('IBGE')
  await expect(frame.locator(`path[data-ibge="${RECIFE}"]`)).toBeVisible()
})

test('a municipality’s details name the two finalists’ votes, and a click opens round 2', async ({
  page,
}) => {
  await page.goto(LULA)
  const map = swingSection(page).getByTestId('race-map')
  await map.scrollIntoViewIfNeeded()
  // On the Brazil map, Recife is smaller than the outline drawn over it, so the test points at it.
  await map
    .locator(`path[data-ibge="${RECIFE}"]`)
    .dispatchEvent('pointermove', { pointerType: 'mouse', bubbles: true })
  const details = page.getByTestId('map-details')
  await expect(details).toContainText('Recife')
  await expect(details).toContainText(/1º turno: [\d,]+% dos votos dos dois finalistas/)
  await expect(details).toContainText(/2º turno: [\d,]+% dos votos dos dois finalistas/)
  await expect(details).toContainText(/Variação: [+−]?[\d,]+ p\.p\./)
  await map.locator(`path[data-ibge="${RECIFE}"]`).dispatchEvent('click', { bubbles: true })
  await expect(page).toHaveURL(
    /\/2026\/segundo-turno\/municipio\/\?uf=pe&mu=25313&cargo=presidente$/,
  )
})

test('the folded list names its denominator, sorts and filters', async ({ page }) => {
  await page.goto(LULA)
  const section = swingSection(page)
  await expect(section.locator('summary').first()).toHaveText('Lista dos 8 municípios')
  await swingRows(page)
  const headers = await section.locator('thead').first().locator('th').allTextContents()
  expect(headers).toEqual([
    'Município',
    '1º turno, dos votos dos dois finalistas',
    '2º turno, dos votos dos dois finalistas',
    'Variação, em p.p.',
  ])
  await section.getByRole('button', { name: 'Pela variação' }).click()
  await expect(section.getByRole('button', { name: 'Pela variação' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await section.getByRole('searchbox').fill('recife')
  await expect(section.locator('tbody tr')).toHaveCount(1)
  await expect(section.locator('tbody tr')).toContainText('Recife')
})

test('the two President finalists’ swings mirror each other', async ({ page }) => {
  await page.goto(LULA)
  const lula = await swingRows(page)
  await page.goto(FLAVIO)
  const flavio = await swingRows(page)
  expect([...flavio.keys()].sort()).toEqual([...lula.keys()].sort())
  const number = (text: string) => Number(text.replace('−', '-').replace(',', '.'))
  for (const [name, change] of lula) {
    expect(number(flavio.get(name) ?? 'NaN'), name).toBe(-number(change) || 0)
  }
})

test('the swing map reads only the files that the share maps already read', async ({ request }) => {
  const html = await (await request.get(LULA)).text()
  const files = new Set(html.match(/\/mapas\/t[12]\/[a-z]{2}\/[0-9a-z-]+\.[0-9a-f]{16}\.json/g))
  expect([...files].map((file) => file.replace(/\.[0-9a-f]{16}\.json$/, '')).sort()).toEqual([
    '/mapas/t1/br/1-votos',
    '/mapas/t2/br/1-votos',
  ])
})

test('a values file that differs from its pin leaves the swing map with no colors and no list', async ({
  page,
}) => {
  await page.route('**/mapas/t1/br/1-votos.*.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
  await page.goto(LULA)
  const section = swingSection(page)
  await section.scrollIntoViewIfNeeded()
  await expect(section.getByRole('alert')).toHaveText('Os números do mapa não carregaram.')
  await expect(section.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
  await expect(section.locator('svg path[data-ibge]')).toHaveCount(0)
  await section.locator('summary').first().click()
  await expect(section.getByTestId('municipality-table')).toHaveCount(0)
})

test('a values file that a later deploy removed offers to reload the page', async ({ page }) => {
  await page.route('**/mapas/t2/br/1-votos.*.json', (route) => route.fulfill({ status: 404 }))
  await page.goto(LULA)
  const section = swingSection(page)
  await section.scrollIntoViewIfNeeded()
  await expect(section.getByRole('alert')).toHaveText(
    'O site foi atualizado desde que esta página abriu.',
  )
  await expect(section.getByRole('button', { name: 'Recarregar a página' })).toBeVisible()
  await expect(section.locator('svg path[data-ibge]')).toHaveCount(0)
})

test('without JavaScript, the swing section says that the map and its list need it', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  for (const [address, note] of [
    [LULA, 'O mapa e a lista de municípios precisam de JavaScript.'],
    [`/en${LULA}`, 'The map and the list of municipalities need JavaScript.'],
  ] as const) {
    await page.goto(address)
    // Playwright turns scripts off without telling the HTML parser, so the test reads the text.
    expect(
      await swingSection(page).getByTestId('race-map').locator('noscript').innerHTML(),
      address,
    ).toBe(note)
    await expect(swingSection(page).getByTestId('municipality-table')).toHaveCount(0)
  }
  await context.close()
})
