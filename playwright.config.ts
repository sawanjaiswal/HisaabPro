import { defineConfig } from '@playwright/test'

/**
 * E2E config — REAL backend, real Postgres. See docs/E2E_TEST_PLAN.md §0.
 *
 * Two web servers are started because the app is split: Vite serves the SPA on
 * 5002 and proxies /api to the Express server on 5001. Pointing Playwright at
 * the SPA alone means every API call 502s (see vite.config.ts BACKEND_DOWN).
 *
 * Ports are NOT arbitrary: vite.config.ts sets `strictPort: true` on 5002, so
 * the old 5173 baseURL could never have reached the app at all.
 *
 * `e2e/legacy-mocked/**` is excluded — those specs stub /api/auth/me with
 * page.route and therefore prove nothing about the server. Quarantined, not
 * counted. New gold-standard specs live in e2e/gold/.
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/legacy-mocked/**'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // shared DB — parallel workers cross-contaminate tenants
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5002',
    browserName: 'chromium',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { viewport: { width: 375, height: 812 } } },
    { name: 'mobile-small', use: { viewport: { width: 320, height: 568 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 720 } } },
  ],
  webServer: [
    {
      command: 'npm run dev:api',
      port: 5001,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { E2E_TEST_HOOKS: '1' },
    },
    {
      command: 'npm run dev:web',
      port: 5002,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
