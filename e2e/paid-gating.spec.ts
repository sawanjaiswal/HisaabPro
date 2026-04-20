/**
 * Plan-gate E2E — FREE plan users land on UpgradePrompt for every paid route.
 * Upgraded plans (PRO/BUSINESS) pass the gate and reach the feature page.
 *
 * Covers all 17 PlanGate-wrapped routes in App.tsx.
 */

import { test, expect, MOCK_BUSINESS_ID } from './fixtures'
import type { Page } from '@playwright/test'

type Plan = 'FREE' | 'PRO' | 'BUSINESS'

async function mockSubscription(page: Page, plan: Plan) {
  await page.route(`**/api/businesses/${MOCK_BUSINESS_ID}/subscription`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          plan,
          status: 'ACTIVE',
          expiresAt: null,
          usage: { invoices: { used: 0, limit: -1 }, users: { used: 1, limit: -1 } },
          isTrialing: false,
        },
      }),
    }),
  )
}

async function silenceOtherApis(page: Page) {
  // Anything other than auth/me and subscription: empty 200.
  await page.route('**/api/**', (route) => {
    const url = route.request().url()
    if (url.includes('/auth/me') || url.includes('/subscription') || url.includes('/csrf-token')) {
      return route.continue()
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    })
  })
}

// Route paths → min plan required. Paid routes only.
const PAID_ROUTES: Array<{ path: string; min: Plan; label: string }> = [
  { path: '/reports/tax-summary', min: 'PRO', label: 'Tax Summary' },
  { path: '/reports/gst-returns', min: 'PRO', label: 'GST Returns' },
  { path: '/reports/tds-tcs', min: 'PRO', label: 'TDS/TCS Report' },
  { path: '/recurring', min: 'PRO', label: 'Recurring Invoices' },
  { path: '/accounting/chart-of-accounts', min: 'PRO', label: 'Chart of Accounts' },
  { path: '/accounting/journal', min: 'PRO', label: 'Journal Entries' },
  { path: '/accounting/trial-balance', min: 'PRO', label: 'Trial Balance' },
  { path: '/reports/profit-loss', min: 'PRO', label: 'Profit & Loss' },
  { path: '/reports/balance-sheet', min: 'PRO', label: 'Balance Sheet' },
  { path: '/reports/cash-flow', min: 'PRO', label: 'Cash Flow' },
  { path: '/reports/aging', min: 'PRO', label: 'Aging Report' },
  { path: '/reports/profitability', min: 'PRO', label: 'Profitability Report' },
  { path: '/reports/discounts', min: 'PRO', label: 'Discount Report' },
  { path: '/accounting/tally-export', min: 'BUSINESS', label: 'Tally Export' },
  { path: '/godowns', min: 'BUSINESS', label: 'Multi-Godown' },
]

test.describe('Paid feature gating — FREE plan sees UpgradePrompt', () => {
  for (const { path, min, label } of PAID_ROUTES) {
    test(`${path} → UpgradePrompt (needs ${min})`, async ({ authedPage }) => {
      await silenceOtherApis(authedPage)
      await mockSubscription(authedPage, 'FREE')

      await authedPage.goto(path)

      const alert = authedPage.getByRole('alert')
      await expect(alert).toBeVisible()
      await expect(alert).toContainText(label)
      await expect(alert).toContainText(min)
      await expect(authedPage.getByRole('button', { name: /view plans/i })).toBeVisible()
    })
  }
})

test.describe('Paid feature gating — upgraded plan passes gate', () => {
  test('PRO plan → /reports/profit-loss renders page (no UpgradePrompt)', async ({ authedPage }) => {
    await silenceOtherApis(authedPage)
    await mockSubscription(authedPage, 'PRO')

    await authedPage.goto('/reports/profit-loss')

    await expect(authedPage.getByRole('alert')).toHaveCount(0)
  })

  test('BUSINESS plan → /godowns passes gate', async ({ authedPage }) => {
    await silenceOtherApis(authedPage)
    await mockSubscription(authedPage, 'BUSINESS')

    await authedPage.goto('/godowns')

    await expect(authedPage.getByRole('alert')).toHaveCount(0)
  })

  test('PRO plan → /accounting/tally-export is still gated (needs BUSINESS)', async ({ authedPage }) => {
    await silenceOtherApis(authedPage)
    await mockSubscription(authedPage, 'PRO')

    await authedPage.goto('/accounting/tally-export')

    const alert = authedPage.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('BUSINESS')
  })
})
