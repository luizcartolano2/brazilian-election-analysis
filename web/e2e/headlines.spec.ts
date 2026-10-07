import { expect, test } from '@playwright/test'
import { leader } from './fixtures'

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('a state page shows the leader of every race and the turnout', async ({ page }) => {
    await page.goto('/2026/pe/')
    for (const race of [1, 3, 5, 6, 7]) {
      await expect(page.getByText(leader('pe', race), { exact: true }).first()).toBeVisible()
    }
    await expect(page.getByText('Comparecimento').first()).toBeVisible()
    await expect(page.getByText('Eleitores aptos').first()).toBeVisible()
  })

  test('the Brazil page shows the presidential results', async ({ page }) => {
    await page.goto('/2026/')
    await expect(page.getByText(leader('br', 1), { exact: true })).toBeVisible()
  })
})
