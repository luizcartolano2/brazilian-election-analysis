import { defineConfig, devices } from '@playwright/test'

const PORT = 3200

/**
 * Tests the static build in out/ through scripts/serve-out.mjs, which applies vercel.json's
 * headers. Build first with ELEICOES_DATA=fixtures npm run build.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/serve-out.mjs',
    url: `http://127.0.0.1:${PORT}/2026/`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
  },
})
