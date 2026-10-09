import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { formatShare } from '../src/lib/format'
import type { CandidateVotes } from '../src/lib/maps'
import { displayName } from '../src/lib/names'
import { summary } from './fixtures'

function readVotes(area: string, race: number): CandidateVotes {
  const file = path.join(import.meta.dirname, '..', '.data', 'mapas', area, `${race}-votos.json`)
  return JSON.parse(readFileSync(file, 'utf-8')) as CandidateVotes
}

test.describe('a race page', () => {
  test('leads a Governor race with its headline and two cards, before the map', async ({
    page,
  }) => {
    await page.goto('/2026/pe/governador/')
    await expect(page.getByTestId('headline')).toHaveText('Raquel Lyra vence no 1º turno')
    await expect(page.getByTestId('result-card')).toHaveCount(2)
    const order = await page.evaluate(() => {
      const top = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect().top ?? Number.NaN
      return { cards: top('[data-testid="result-cards"]'), map: top('[data-testid="race-map"]') }
    })
    expect(order.cards).toBeLessThan(order.map)
  })

  test('states the count elected in a deputy race, with no cards', async ({ page }) => {
    const race = summary('pe').corridas.find((entry) => entry.cargo === 6)
    const elected = (race?.candidatos ?? []).filter((candidate) =>
      candidate.resultado.startsWith('Eleito'),
    ).length
    await page.goto('/2026/pe/deputado-federal/')
    await expect(page.getByTestId('headline')).toHaveText(
      elected > 0
        ? `Deputado federal: ${elected} vagas preenchidas`
        : /^Deputado federal: \d+ vagas$/,
    )
    await expect(page.getByTestId('result-card')).toHaveCount(0)
  })
})

test.describe('a candidate page', () => {
  test('states a runoff with its date', async ({ page }) => {
    await page.goto('/2026/ac/governador/11/')
    await expect(page.getByTestId('headline')).toHaveText(
      'Vai ao 2º turno, em 25 de outubro de 2026',
    )
  })

  test('states an election in the first round', async ({ page }) => {
    await page.goto('/2026/pe/governador/55/')
    await expect(page.getByTestId('headline')).toHaveText('Vence no 1º turno')
    await expect(page.getByTestId('candidate-place')).toHaveText('1º lugar')
  })

  test('states the place of a candidate with neither outcome, in each language', async ({
    page,
  }) => {
    await page.goto('/2026/pe/governador/40/')
    await expect(page.getByTestId('headline')).toHaveText('Termina em 2º lugar')
    await expect(page.getByTestId('candidate-place')).toHaveText('2º lugar')
    await page.goto('/en/2026/pe/governador/40/')
    await expect(page.getByTestId('headline')).toHaveText('Finishes in 2nd place')
  })

  test('lists the six largest municipalities, with the candidate’s share in each', async ({
    page,
  }) => {
    const votes = readVotes('br', 1)
    const column = votes.numbers.indexOf(13)
    const expected = [...votes.rows]
      .sort((a, b) => b[3] - a[3] || a[1] - b[1])
      .slice(0, 6)
      .map((row) => ({
        name: displayName(row[2]),
        share: formatShare('pt', (row[4 + column] as number) ?? 0, row[3]),
      }))
    await page.goto('/2026/presidente/13/')
    const rows = page.getByTestId('largest').locator('tbody tr')
    await expect(rows).toHaveCount(Math.min(6, votes.rows.length))
    for (const [index, entry] of expected.entries()) {
      await expect(rows.nth(index)).toContainText(entry.name)
      await expect(rows.nth(index)).toContainText(entry.share)
    }
  })

  test('shows its status for votes under appeal, with no place and no list', async ({ page }) => {
    await page.goto('/2026/ac/senador/111/')
    await expect(page.getByTestId('headline')).toHaveText('Votos sob recurso: Anulado sub judice')
    await expect(page.getByTestId('candidate-place')).toHaveCount(0)
    await expect(page.getByTestId('largest')).toHaveCount(0)
  })

  test('shows no list in an area with one municipality', async ({ page }) => {
    await page.goto('/2026/se/governador/55/')
    await expect(page.getByTestId('headline')).toHaveText('Vence no 1º turno')
    await expect(page.getByTestId('largest')).toHaveCount(0)
  })

  test('lists a President candidate’s share in each state, and counts the states led', async ({
    page,
  }) => {
    const states = ['ac', 'pe', 'se'].map((area) => {
      const race = summary(area).corridas.find((entry) => entry.cargo === 1)
      const valid = (race?.candidatos ?? [])
        .filter((candidate) => candidate.destino === 'Válido')
        .sort((a, b) => b.votos - a.votos)
      const votes = valid.find((candidate) => candidate.numero === 13)?.votos ?? 0
      return { area, share: votes / (race?.validos ?? 1), led: valid[0]?.numero === 13 }
    })
    const order = [...states].sort((a, b) => b.share - a.share).map((state) => state.area)
    const led = states.filter((state) => state.led).length

    await page.goto('/2026/presidente/13/')
    await expect(page.getByTestId('states-led')).toHaveText(
      `${led} ${led === 1 ? 'estado' : 'estados'}`,
    )
    const links = page.getByTestId('state-shares').locator('tbody tr a')
    await expect(links).toHaveCount(states.length)
    for (const [index, area] of order.entries()) {
      await expect(links.nth(index)).toHaveAttribute('href', `/2026/${area}/`)
    }
  })
})

test('a wide map frame puts its legend beside the map, a narrow one below it', async ({ page }) => {
  const layout = async () => {
    const map = page.getByTestId('race-map').first()
    await map.scrollIntoViewIfNeeded()
    await expect(map.locator('svg')).toBeVisible()
    const legend = await map.locator('xpath=ancestor::figure').locator('figcaption').boundingBox()
    const drawn = await map.boundingBox()
    if (legend === null || drawn === null) throw new Error('the map frame has no box')
    return { legend, drawn }
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/2026/pe/governador/')
  const wide = await layout()
  expect(wide.legend.x).toBeGreaterThanOrEqual(wide.drawn.x + wide.drawn.width)
  await page.goto('/2026/pe/')
  const narrow = await layout()
  expect(narrow.legend.y).toBeGreaterThanOrEqual(narrow.drawn.y + narrow.drawn.height)
})
