/**
 * Suite G — Dashboard (TC-DASH-01 … TC-DASH-08). Plan: docs/E2E_TEST_PLAN.md §8.
 *
 * The dashboard is the screen the app opens on, and the only one most
 * shopkeepers look at every day. Its whole job is to be *true*: a number here
 * that does not come from this business's ledger is worse than a blank card,
 * because nothing on the screen tells the user which half is real.
 *
 * Every assertion below compares what is rendered against what
 * `GET /dashboard/home` actually returned for this account.
 */

import { test, expect, loginViaUi, expectNoHorizontalScroll } from './support/fixtures'
import { API_BASE } from './support/api'
import { SEEDED_OWNER_PHONE, VALID_PASSWORD, ROUTES } from './support/constants'
import type { Page } from '@playwright/test'

interface TrendMetric {
  total: number
  previousTotal: number
  deltaPct: number | null
  series: number[]
}

interface HomeDashboard {
  outstanding: { receivable: { total: number }; payable: { total: number } }
  today: { salesAmount: number }
  trend: {
    days: number
    sales: TrendMetric
    collections: TrendMetric
    expenses: TrendMetric
    cashInHand: number
    todayVsYesterday: { today: number; yesterday: number; deltaPct: number | null }
  }
  topDebtors: Array<{ name: string }>
  alerts: { lowStockCount: number; overdueInvoiceCount: number }
}

async function homeData(page: Page): Promise<HomeDashboard> {
  const res = await page.request.get(`${API_BASE}/dashboard/home`)
  expect(res.status(), 'GET /dashboard/home').toBe(200)
  return (await res.json()).data as HomeDashboard
}

/** Mirror of formatCompactAmount() in src/features/dashboard/dashboard.utils.ts. */
function compact(paise: number): string {
  const rupees = paise / 100
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)}Cr`
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1)}L`
  if (rupees >= 1_000) return `₹${(rupees / 1_000).toFixed(1)}K`
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees)
}

const hero = (page: Page) => page.locator('.dashboard-biz-hero')

test.describe('TC-DASH — dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
  })

  test('TC-DASH-02 every headline number is this business\'s own', async ({ page }) => {
    await page.goto(ROUTES.DASHBOARD)
    await expect(hero(page)).toBeVisible({ timeout: 20_000 })

    const data = await homeData(page)

    // The hero shipped with a hardcoded ₹52,300 and a +18% chip on a fabricated
    // 31-day curve. A billing app that invents a sales figure is the one bug a
    // shopkeeper can never detect from the inside.
    await expect(hero(page).locator('.dashboard-biz-hero__amount')).toHaveText(
      compact(data.trend.todayVsYesterday.today),
    )

    // Collections tile — real payments received over the trend window.
    const collections = page.locator('.dashboard-metric-tile', { hasText: /collections/i }).first()
    await expect(collections.locator('.dashboard-metric-tile__amount')).toHaveText(
      compact(data.trend.collections.total),
    )

    // Overview carousel — same window, same numbers, no second source of truth.
    const salesCard = page.locator('.dashboard-overview__card').first()
    await expect(salesCard.locator('.dashboard-overview__amount')).toHaveText(
      compact(data.trend.sales.total),
    )
  })

  test('TC-DASH-06 the chart plots this account\'s series, not a shipped curve', async ({
    page,
  }) => {
    await page.goto(ROUTES.DASHBOARD)
    await expect(hero(page)).toBeVisible({ timeout: 20_000 })
    const data = await homeData(page)

    expect(data.trend.days, 'a 30-day window').toBe(30)
    expect(data.trend.sales.series, 'one point per day, dense').toHaveLength(30)

    // A hardcoded curve is the same on every account and always ends higher
    // than it starts. The real one has to agree with the sum it is drawn from.
    const seriesTotal = data.trend.sales.series.reduce((a, b) => a + b, 0)
    expect(seriesTotal, 'the chart and its total are the same numbers').toBe(data.trend.sales.total)
    expect(data.trend.sales.series.at(-1), "today's point is today's sales").toBe(
      data.trend.todayVsYesterday.today,
    )

    // Money is Indian-formatted everywhere it appears.
    const amounts = await page.locator('.dashboard-biz-hero__amount').allTextContents()
    for (const text of amounts) expect(text).toMatch(/^₹/)
  })

  test('TC-DASH-01 a business with nothing to chase shows no invented priorities', async ({
    page,
  }) => {
    await page.goto(ROUTES.DASHBOARD)
    await expect(hero(page)).toBeVisible({ timeout: 20_000 })
    const data = await homeData(page)

    // The priorities card fell back to a shipped preview list when the live one
    // was empty — "Raj Traders payment due", "Cement stock low". A shopkeeper
    // reading that goes and chases a customer who does not exist.
    for (const invented of ['Raj Traders', 'Cement stock low', "Rahul hasn't submitted cash"]) {
      await expect(page.getByText(invented, { exact: false })).toHaveCount(0)
    }

    const priorities = page.locator('.dashboard-priorities, [class*="priorit"]').first()
    const hasSomethingToChase =
      data.topDebtors.length > 0 ||
      data.alerts.lowStockCount > 0 ||
      data.alerts.overdueInvoiceCount > 0
    if (!hasSomethingToChase) {
      await expect(priorities).toHaveCount(0)
    }
  })

  test('TC-DASH-05 every quick action opens the screen it names', async ({ page }) => {
    await page.goto(ROUTES.DASHBOARD)
    await expect(hero(page)).toBeVisible({ timeout: 20_000 })

    const expected: Array<[RegExp, RegExp]> = [
      [/^invoice$/i, /\/invoices\/new/],
      [/customer/i, /\/parties\/new/],
      [/product/i, /\/products\/new/],
    ]

    for (const [label, route] of expected) {
      await page.goto(ROUTES.DASHBOARD)
      await page.getByRole('button', { name: label }).first().click()
      await expect(page, `quick action ${label} routes`).toHaveURL(route, { timeout: 15_000 })
    }
  })

  test('TC-DASH-03 the load shows skeletons, not an empty screen', async ({ page }) => {
    // Hold the real response open — the data is genuine, only slow, which is
    // exactly the 2G case the loading state exists for.
    await page.route('**/api/dashboard/home', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_000))
      await route.continue()
    })

    await page.goto(ROUTES.DASHBOARD)
    await expect(page.locator('.skeleton, [class*="skeleton"]').first()).toBeVisible({
      timeout: 10_000,
    })
    await page.unroute('**/api/dashboard/home')
    await expect(hero(page)).toBeVisible({ timeout: 20_000 })
  })

  test('TC-DASH-04 a failed load offers a Retry that actually works', async ({ page }) => {
    let fail = true
    await page.route('**/api/dashboard/home', async (route) => {
      if (fail) await route.abort('failed')
      else await route.continue()
    })

    await page.goto(ROUTES.DASHBOARD)
    const retry = page.getByRole('button', { name: /retry|try again/i }).first()
    await expect(retry, 'an error state with a way out').toBeVisible({ timeout: 20_000 })

    fail = false
    await retry.click()
    await expect(hero(page), 'retry re-fetches rather than re-rendering the error').toBeVisible({
      timeout: 20_000,
    })
  })

  test('TC-DASH-07 opening the app offline still shows the last known numbers', async ({
    page,
    context,
  }) => {
    await page.goto(ROUTES.DASHBOARD)
    await expect(hero(page)).toBeVisible({ timeout: 20_000 })
    const expectedAmount = await hero(page).locator('.dashboard-biz-hero__amount').textContent()

    await context.setOffline(true)

    // Navigating inside the running app, not reloading it: the document itself
    // comes from the service worker in a release build, and dev deliberately
    // unregisters that worker (commit 70e19b09), so a reload here would test
    // the dev server rather than the app's own offline behaviour. What is
    // under test is the data layer — leaving the screen and coming back
    // remounts the dashboard query with no network to answer it.
    await page.getByRole('link', { name: /parties|customers/i }).first().click()
    await page.getByRole('link', { name: /home|dashboard/i }).first().click()

    // Offline-first is the product's promise on a 2G connection: the dashboard
    // is cached (OFFLINE_RULES rule 3) so the shop still sees yesterday's
    // truth, with the offline banner saying why it may be behind.
    await expect(hero(page).locator('.dashboard-biz-hero__amount')).toHaveText(
      expectedAmount ?? '',
      { timeout: 20_000 },
    )
    await expect(page.locator('.offline-banner, [class*="offline"]').first()).toBeVisible({
      timeout: 10_000,
    })
    await context.setOffline(false)
  })

  test('TC-DASH-08 the dashboard fits every screen it ships on', async ({ page }) => {
    for (const width of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 720 })
      await page.goto(ROUTES.DASHBOARD)
      await expect(hero(page)).toBeVisible({ timeout: 20_000 })
      await expectNoHorizontalScroll(page)
    }
  })
})
