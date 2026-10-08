import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __violations: string[]
  }
}

const RECIFE = 2611606

async function drawnMap(page: Page, address: string) {
  await page.goto(address)
  const map = page.getByTestId('race-map').first()
  await map.scrollIntoViewIfNeeded()
  await expect(map.locator('svg')).toBeVisible()
  return map
}

function rows(page: Page) {
  return page.getByTestId('municipality-table').locator('tbody tr')
}

test('a Governor map frame holds the race, area, round, legend, statement and both credits', async ({
  page,
}) => {
  const map = await drawnMap(page, '/2026/pe/governador/')
  const frame = map.locator('xpath=ancestor::figure')

  await expect(map.locator('svg path[data-ibge]')).toHaveCount(3)
  await expect(frame).toContainText('Governador · Pernambuco · 1º turno')
  await expect(frame).toContainText('As cores mostram o candidato mais votado em cada município.')
  await expect(frame).toContainText('apertada, abaixo de 5 p.p.')
  await expect(frame).toContainText('Raquel Lyra (PSD)')
  await expect(frame).toContainText('Fonte: Tribunal Superior Eleitoral (TSE)')
  await expect(frame).toContainText('Limites municipais: IBGE')
})

test("Pernambuco's map draws Fernando de Noronha in its own box", async ({ page }) => {
  const map = await drawnMap(page, '/2026/pe/governador/')

  await expect(map.locator('svg g rect')).toHaveCount(1)
  await expect(map.locator('svg text')).toHaveText('Fernando de Noronha')
})

test('an English map names its race, round and bins in English', async ({ page }) => {
  const map = await drawnMap(page, '/en/2026/pe/governador/')
  const frame = map.locator('xpath=ancestor::figure')

  await expect(frame).toContainText('Governor · Pernambuco · round 1')
  await expect(frame).toContainText('close, under 5 points')
})

test('the Brazil page maps President in every state, and links to the votes abroad', async ({
  page,
}) => {
  const map = await drawnMap(page, '/2026/')

  await expect(map.locator('svg path[data-ibge]')).toHaveCount(8)
  await expect(
    page.getByRole('link', { name: 'Votos para presidente no exterior' }),
  ).toHaveAttribute('href', '/2026/zz/')
})

test('each state on the Brazil page links to its President race page, which lists it', async ({
  page,
}) => {
  await page.goto('/2026/')
  const pernambuco = page.getByRole('listitem').filter({ hasText: 'Pernambuco' })
  await pernambuco.getByRole('link', { name: 'presidente por município' }).click()

  await expect(page).toHaveURL('/2026/pe/presidente/')
  await expect(rows(page).filter({ hasText: 'Recife' })).toHaveCount(1)
})

test('a state page maps its Governor race, and folds its list', async ({ page }) => {
  const map = await drawnMap(page, '/2026/pe/')

  await expect(map.locator('xpath=ancestor::figure')).toContainText('Governador · Pernambuco')
  await expect(rows(page).first()).toBeHidden()
  await page.getByText('Ver os 3 municípios').click()
  await expect(rows(page)).toHaveCount(3)
})

test('a Senate frame says that each voter chose two, and English details use English ordinals', async ({
  page,
}) => {
  const map = await drawnMap(page, '/en/2026/pe/senador/')

  await expect(map.locator('xpath=ancestor::figure')).toContainText(
    'Each voter chose two candidates for two seats',
  )
  await map.locator(`path[data-ibge="${RECIFE}"]`).hover()
  await expect(page.getByTestId('map-details')).toContainText('1st')
  await expect(page.getByTestId('map-details')).not.toContainText('1º')
})

test('abroad shows no map', async ({ page }) => {
  await page.goto('/2026/zz/')
  await expect(page.getByTestId('race-map')).toHaveCount(0)
})

for (const [label, handle] of [
  ['an altered boundary file', 'altered'],
  ['a failed boundary download', 'failed'],
] as const) {
  test(`${label} draws no map, says so, and keeps the list`, async ({ page }) => {
    await page.route('**/_fixtures/geo/pe.json', async (route) => {
      if (handle === 'failed') return route.abort()
      const response = await route.fetch()
      const body = (await response.text()).replace('"type"', ' "type"')
      return route.fulfill({ response, body })
    })
    await page.goto('/2026/pe/governador/')
    const map = page.getByTestId('race-map')
    await map.scrollIntoViewIfNeeded()

    await expect(map.getByRole('alert')).toHaveText(
      'O mapa não carregou. A lista abaixo traz os mesmos dados.',
    )
    await expect(map.locator('svg')).toHaveCount(0)
    await expect(rows(page)).toHaveCount(3)
  })
}

test('a click on Recife opens its view on the race shown', async ({ page }) => {
  const map = await drawnMap(page, '/2026/pe/governador/')
  await map.locator(`path[data-ibge="${RECIFE}"]`).click()

  await expect(page).toHaveURL('/2026/municipio/?uf=pe&mu=25313&cargo=governador')
})

test('a pointer on a municipality shows its details', async ({ page }) => {
  const map = await drawnMap(page, '/2026/pe/governador/')
  await map.locator(`path[data-ibge="${RECIFE}"]`).hover()

  const details = page.getByTestId('map-details')
  await expect(details).toContainText('Recife')
  await expect(details).toContainText('João Campos (PSB)')
  await expect(details).toContainText('p.p. · clara')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true })

  test('a tap shows the details with a link to the view', async ({ page }) => {
    const map = await drawnMap(page, '/2026/pe/governador/')
    await map.locator(`path[data-ibge="${RECIFE}"]`).tap()

    const details = page.getByTestId('map-details')
    await expect(details).toContainText('Recife')
    await expect(details.getByRole('link', { name: 'Ver RECIFE' })).toHaveAttribute(
      'href',
      '/2026/municipio/?uf=pe&mu=25313&cargo=governador',
    )
    await expect(page).toHaveURL('/2026/pe/governador/')
  })

  test('a swipe that starts on the map scrolls the page', async ({ page }) => {
    const map = await drawnMap(page, '/2026/pe/governador/')
    const box = await map.boundingBox()
    if (box === null) throw new Error('the map has no box')
    const before = await page.evaluate(() => window.scrollY)
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    const session = await page.context().newCDPSession(page)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (let step = 1; step <= 10; step++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - step * 20 }],
      })
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before)
  })

  test('a mapped page needs no horizontal scrolling with its map drawn', async ({ page }) => {
    await drawnMap(page, '/2026/pe/governador/')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )

    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test('without JavaScript the list is complete, and says that the map needs JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/2026/pe/governador/')

  // A browser with JavaScript off shows <noscript>. Playwright turns scripts off without telling
  // the HTML parser, so the test reads the element's text instead.
  expect(await page.getByTestId('race-map').locator('noscript').innerHTML()).toBe(
    'O mapa precisa de JavaScript. A lista abaixo traz os mesmos dados.',
  )
  await expect(rows(page)).toHaveCount(3)
  await expect(rows(page).filter({ hasText: 'Recife' })).toContainText('João Campos (PSB)')
  await expect(rows(page).filter({ hasText: 'Recife' })).toContainText('p.p.')
  await context.close()
})

test('sorting by margin puts the closest municipality first', async ({ page }) => {
  await page.goto('/2026/pe/governador/')
  await expect(rows(page).first()).toContainText('Agrestina')
  await expect(rows(page).nth(1)).toContainText('Fernando de Noronha')

  await page.getByRole('button', { name: 'Pela margem' }).click()

  await expect(rows(page).nth(0)).toContainText('Agrestina')
  await expect(rows(page).nth(1)).toContainText('Recife')
  await expect(rows(page).nth(2)).toContainText('Fernando de Noronha')
})

test('a Senate list shows the two most voted with their shares, and sorts by name only', async ({
  page,
}) => {
  await page.goto('/2026/pe/senador/')
  const table = page.getByTestId('municipality-table')

  await expect(table.locator('thead th')).toHaveText(['Município', '1º', '2º'])
  await expect(rows(page).first()).toContainText('%')
  await expect(page.getByRole('button', { name: 'Pela margem' })).toHaveCount(0)
})

test('the filter ignores case and accents', async ({ page }) => {
  await page.goto('/2026/ac/governador/')
  await page.getByPlaceholder('Filtrar municípios').fill('brasileia')

  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page)).toContainText('Brasiléia')
})

test.describe('with its map drawn, under the production headers', () => {
  for (const address of ['/2026/', '/2026/pe/', '/en/2026/pe/deputado-estadual/']) {
    test(`${address} reports no policy violation`, async ({ page }) => {
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
      await drawnMap(page, address)

      expect(await page.evaluate(() => window.__violations)).toEqual([])
      expect(errors).toEqual([])
    })
  }
})
