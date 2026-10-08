import { expect, test, type Page } from '@playwright/test'
import { formatInteger, formatShare } from '../src/lib/format'
import { OTHER, SHADES } from '../src/lib/map-colors'
import { binOf, candidateRanks } from '../src/lib/maps'
import { raceResults, type SummaryRace } from '../src/lib/results'
import { leader, summary } from './fixtures'

function president(area: string): SummaryRace {
  const race = summary(area).corridas.find((entry) => entry.cargo === 1)
  if (race === undefined) throw new Error(`${area} has no President race`)
  return race
}

function rgb(hex: string): string {
  const [red, green, blue] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
  return `rgb(${red}, ${green}, ${blue})`
}

/** Leaves every script out, as when the tabs' chunk fails to load. CSS still loads. */
async function blockScripts(page: Page) {
  await page.route('**/*', (route) =>
    route.request().resourceType() === 'script' ? route.abort() : route.continue(),
  )
}

test.describe('the Brazil page', () => {
  test('leads with the runoff and both cards, before the map and the full results', async ({
    page,
  }) => {
    await page.goto('/2026/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Flavio Bolsonaro e Lula vão ao 2º turno',
    )
    const order = await page.evaluate(() => {
      const top = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect().top ?? Number.NaN
      return {
        cards: top('[data-testid="result-cards"]'),
        map: top('[data-map="br-presidente"]'),
        table: top('#candidato-22'),
      }
    })
    expect(order.cards).toBeLessThan(order.map)
    expect(order.map).toBeLessThan(order.table)
  })

  test('still shows every number the old page showed', async ({ page }) => {
    const race = president('br')
    await page.goto('/2026/')
    for (const value of [race.aptos, race.comparecimento, race.abstencoes]) {
      await expect(
        page.getByText(formatInteger('pt', value), { exact: true }).first(),
      ).toBeVisible()
    }
    await expect(page.locator('table tbody tr[id^="candidato-"]')).toHaveCount(
      race.candidatos.filter((candidate) => candidate.destino === 'Válido').length,
    )
    await expect(page.getByRole('table', { name: 'Totais' })).toBeVisible()
  })

  test('shows the PE tile in its leader’s shade, named like its row in the list', async ({
    page,
  }) => {
    const pe = president('pe')
    const results = raceResults(pe, false)
    const [first, second] = results.candidates
    if (first === undefined || second === undefined) throw new Error('PE has no two candidates')
    const valid = results.totals.valid
    const rank = candidateRanks(pe, president('br')).get(first.number)
    const margin = ((first.votes - second.votes) / valid) * 100
    const fill = rank === undefined ? OTHER : SHADES[rank][binOf(margin)]

    await page.goto('/2026/')
    const tile = page.locator('[data-state="pe"]')
    await expect(tile).toHaveAttribute('href', '/2026/pe/')
    await expect(tile).toHaveCSS('background-color', rgb(fill))
    await expect(tile).toContainText(formatShare('pt', first.votes, valid))

    const list = page.getByTestId('state-list')
    await expect(list).not.toHaveAttribute('open')
    await list.locator('summary').click()
    const link = list.getByRole('link', { name: 'Pernambuco' })
    await expect(link).toHaveAttribute('href', '/2026/pe/presidente/')
    const cells = await list
      .locator('tbody tr')
      .filter({ hasText: 'Pernambuco' })
      .locator('td')
      .allInnerTexts()
    await expect(tile).toHaveAttribute('aria-label', `${cells[0]}: ${cells[1]}, ${cells[2]}`)
  })

  test.describe('at 360 pixels wide', () => {
    test.use({ viewport: { width: 360, height: 740 } })

    test('fits the whole grid, with tiles at least 44 pixels wide', async ({ page }) => {
      await page.goto('/2026/')
      const boxes = await page
        .locator('[data-state]')
        .evaluateAll((tiles) => tiles.map((tile) => tile.getBoundingClientRect().toJSON()))
      expect(boxes.length).toBeGreaterThan(0)
      for (const box of boxes) {
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.right).toBeLessThanOrEqual(360)
      }
    })
  })
})

test.describe('the state page', () => {
  test('delivers every race’s headline and cards in its HTML', async ({ request }) => {
    const html = await (await request.get('/2026/pe/')).text()
    for (const slug of ['governador', 'senador', 'presidente']) {
      expect(html).toContain(`id="${slug}"`)
    }
    expect(html.match(/data-testid="headline"/g)).toHaveLength(3)
    expect(html.match(/data-testid="result-cards"/g)).toHaveLength(3)
    for (const race of [1, 3, 5]) expect(html).toContain(leader('pe', race))
  })

  test('links each deputy race, with its most voted candidate', async ({ page }) => {
    await page.goto('/2026/pe/')
    const deputies = page.getByTestId('deputies')
    await expect(deputies.locator('[data-race="deputado-federal"]')).toHaveAttribute(
      'href',
      '/2026/pe/deputado-federal/',
    )
    await expect(deputies.locator('[data-race="deputado-federal"]')).toContainText(leader('pe', 6))
    await expect(deputies.locator('[data-race="deputado-estadual"]')).toContainText(leader('pe', 7))
  })

  test('opens the tab that the address names', async ({ page }) => {
    await page.goto('/2026/pe/#senador')
    await expect(page.getByRole('tab', { name: 'Senador' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.locator('#senador')).toBeVisible()
    await expect(page.locator('#governador')).toBeHidden()
  })

  test('moves between tabs with the keyboard, without new history entries', async ({ page }) => {
    await page.goto('/2026/pe/')
    const before = await page.evaluate(() => history.length)
    const tab = (name: string) => page.getByRole('tab', { name })
    await tab('Governador').focus()
    await page.keyboard.press('ArrowRight')
    await expect(tab('Senador')).toHaveAttribute('aria-selected', 'true')
    await expect(tab('Senador')).toBeFocused()
    await expect(page).toHaveURL(/#senador$/)
    await page.keyboard.press('End')
    await expect(tab('Presidente')).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Home')
    await expect(tab('Governador')).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowLeft')
    await expect(tab('Presidente')).toHaveAttribute('aria-selected', 'true')
    await tab('Senador').click()
    await expect(page.locator('#senador')).toBeVisible()
    expect(await page.evaluate(() => history.length)).toBe(before)
  })

  test('gives a screen reader a tab list, its tabs and one panel', async ({ page }) => {
    await page.goto('/2026/pe/')
    const list = page.getByRole('tablist', { name: 'Disputas em Pernambuco' })
    await expect(list.getByRole('tab')).toHaveCount(3)
    await expect(list.getByRole('tab', { name: 'Governador' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByRole('tabpanel')).toHaveCount(1)
    await expect(page.getByRole('tabpanel', { name: 'Governador' })).toBeVisible()
  })

  test('selects the tab of a panel that find-in-page reveals', async ({ page }) => {
    await page.goto('/2026/pe/')
    await expect(page.getByRole('tablist')).toBeVisible()
    await page.locator('#presidente').dispatchEvent('beforematch')
    await expect(page.getByRole('tab', { name: 'Presidente' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('shows only the addressed panel before any script runs', async ({ page }) => {
    await blockScripts(page)
    await page.goto('/2026/pe/')
    await expect(page.locator('#governador')).toBeVisible()
    await expect(page.locator('#senador')).toBeHidden()
    await expect(page.locator('#presidente')).toBeHidden()
    await page.goto('/2026/pe/#senador')
    await page.reload()
    await expect(page.locator('#senador')).toBeVisible()
    await expect(page.locator('#governador')).toBeHidden()
  })

  test('still shows a panel when its tab is chosen and the script failed', async ({ page }) => {
    await blockScripts(page)
    await page.goto('/2026/pe/')
    await page.getByRole('link', { name: 'Presidente', exact: true }).click()
    await expect(page.locator('#presidente')).toBeVisible()
    await expect(page.locator('#governador')).toBeHidden()
  })

  test('lists the closest Governor races by margin, each linking to its municipality', async ({
    page,
  }) => {
    await page.goto('/2026/pe/')
    const closest = page.getByTestId('closest')
    const margins = await closest
      .locator('li')
      .evaluateAll((items) =>
        items.map((item) =>
          Number(/([\d,]+) p\.p\./.exec(item.textContent ?? '')?.[1]?.replace(',', '.')),
        ),
      )
    expect(margins.length).toBeGreaterThan(1)
    expect(margins).toEqual([...margins].sort((a, b) => a - b))
    await expect(closest.getByRole('link').first()).toHaveAttribute(
      'href',
      /^\/2026\/municipio\/\?uf=pe&mu=\d+&cargo=governador$/,
    )
  })

  test('shows no closest races in a state with one municipality', async ({ page }) => {
    await page.goto('/2026/se/')
    await expect(page.getByTestId('headline').first()).toBeVisible()
    await expect(page.getByTestId('closest')).toHaveCount(0)
  })

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    test('shows every panel, one after another', async ({ page }) => {
      await page.goto('/2026/pe/')
      for (const slug of ['governador', 'senador', 'presidente']) {
        await expect(page.locator(`#${slug}`)).toBeVisible()
      }
    })

    test('reads the state tiles and their list on the Brazil page', async ({ page }) => {
      await page.goto('/2026/')
      await expect(page.locator('[data-state="pe"]')).toBeVisible()
      expect(await page.getByTestId('state-list').innerHTML()).toContain('Pernambuco')
    })
  })
})

test('the votes-abroad page opens with the President headline and two cards, and no tabs', async ({
  page,
}) => {
  await page.goto('/2026/zz/')
  await expect(page.getByTestId('headline')).toBeVisible()
  await expect(page.getByTestId('result-card')).toHaveCount(2)
  await expect(page.getByRole('tablist')).toHaveCount(0)
})
