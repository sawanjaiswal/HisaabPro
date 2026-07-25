/**
 * A11y sweep — axe-core scan on key authenticated pages.
 * Fails on any CRITICAL or SERIOUS WCAG 2.1 AA violation.
 *
 * Tier below (moderate/minor) is surfaced but not failing — keeps the signal
 * strong without turning the suite into a nagging firehose.
 */

import AxeBuilder from '@axe-core/playwright'
import { test, expect, MOCK_BUSINESS_ID } from './fixtures'
import type { Page } from '@playwright/test'

async function mockSubscription(page: Page) {
  await page.route(`**/api/businesses/${MOCK_BUSINESS_ID}/subscription`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          plan: 'BUSINESS',
          status: 'ACTIVE',
          expiresAt: null,
          usage: { invoices: { used: 0, limit: -1 }, users: { used: 1, limit: -1 } },
          isTrialing: false,
        },
      }),
    }),
  )
}

async function silenceApis(page: Page) {
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

const KEY_PAGES: Array<{ name: string; path: string }> = [
  { name: 'Login',       path: '/login' },
  { name: 'Dashboard',   path: '/' },
  { name: 'Invoices',    path: '/invoices' },
  { name: 'Parties',     path: '/parties' },
  { name: 'Products',    path: '/products' },
  { name: 'Settings',    path: '/settings' },
  { name: 'Profit/Loss', path: '/reports/profit-loss' },
  { name: 'Chart of Accounts', path: '/accounting/chart-of-accounts' },
]

test.describe('a11y sweep — WCAG 2.1 AA, no critical/serious violations', () => {
  for (const { name, path } of KEY_PAGES) {
    test(`${name} (${path})`, async ({ authedPage }) => {
      await silenceApis(authedPage)
      await mockSubscription(authedPage)

      await authedPage.goto(path)
      await authedPage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

      const results = await new AxeBuilder({ page: authedPage })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      const blocking = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      )

      if (blocking.length) {
        const report = blocking
          .map((v) => `  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length > 1 ? 's' : ''})`)
          .join('\n')
        console.error(`\n${name} axe violations:\n${report}`)
      }

      expect(blocking, `${name} has critical/serious a11y violations`).toEqual([])
    })
  }
})
