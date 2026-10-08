import { expect, test } from '@playwright/test'
import { PAGES } from './fixtures'

declare global {
  interface Window {
    __violations: string[]
  }
}

test.describe('under the production headers', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__violations = []
      document.addEventListener('securitypolicyviolation', (event) => {
        window.__violations.push(`${event.violatedDirective} ${event.blockedURI}`)
      })
    })
  })

  for (const address of PAGES) {
    test(`${address} loads with no policy violation`, async ({ page, baseURL }) => {
      const errors: string[] = []
      const elsewhere: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      page.on('request', (request) => {
        const kind = request.resourceType()
        if (
          (kind === 'font' || kind === 'stylesheet') &&
          new URL(request.url()).origin !== baseURL
        ) {
          elsewhere.push(request.url())
        }
      })
      const response = await page.goto(address)
      expect(response?.status()).toBe(200)
      expect(response?.headers()['content-security-policy']).toContain("default-src 'self'")
      await page.waitForLoadState('networkidle')
      expect(await page.evaluate(() => window.__violations)).toEqual([])
      expect(errors).toEqual([])
      expect(elsewhere).toEqual([])
    })
  }
})

test.describe('at 360 pixels wide', () => {
  test.use({ viewport: { width: 360, height: 740 } })

  for (const address of PAGES) {
    test(`${address} needs no horizontal scrolling`, async ({ page }) => {
      await page.goto(address)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})
