import { test, expect, mockApiGet } from './fixtures'

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_DAY_BOOK = {
  dayLabel: 'Monday, 17 Mar 2026',
  summary: {
    totalSales: { amount: 0, count: 0 },
    totalPurchases: { amount: 0, count: 0 },
    paymentsIn: { amount: 0, count: 0 },
    paymentsOut: { amount: 0, count: 0 },
    netCashFlow: 0,
  },
  transactions: [],
  navigation: { prevDate: '2026-03-16', nextDate: null },
}

const MOCK_INVOICE_REPORT = {
  summary: { totalInvoices: 0, totalAmount: 0, totalPaid: 0, totalOutstanding: 0 },
  items: [],
  groups: [],
}

const MOCK_STOCK_SUMMARY = {
  summary: {
    totalProducts: 0,
    totalStockValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  },
  items: [],
  categories: [],
}

const MOCK_PAYMENT_HISTORY = {
  summary: {
    totalIn: 0,
    totalOut: 0,
    netFlow: 0,
    totalCount: 0,
  },
  items: [],
  groups: [],
}

const MOCK_META = { hasMore: false, cursor: null, total: 0 }

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Reports Hub', () => {
  test('renders with report category cards', async ({ authedPage: page }) => {
    await page.goto('/reports')
    await page.waitForLoadState('domcontentloaded')

    // Hub hero banner
    await expect(page.getByText('Business Insights')).toBeVisible()

    // All 5 report categories should be visible
    await expect(page.getByLabel('View Sales Report')).toBeVisible()
    await expect(page.getByLabel('View Purchase Report')).toBeVisible()
    await expect(page.getByLabel('View Stock Summary')).toBeVisible()
    await expect(page.getByLabel('View Day Book')).toBeVisible()
    await expect(page.getByLabel('View Payment History')).toBeVisible()
  })

  test('no horizontal scroll on 375px', async ({ authedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/reports')
    await page.waitForLoadState('domcontentloaded')

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
})

test.describe('Sales Report', () => {
  test('renders with date range filter', async ({ authedPage: page }) => {
    await mockApiGet(page, 'reports/invoices**', {
      ...MOCK_INVOICE_REPORT,
    })
    // Also mock the meta wrapper expected by the hook
    await page.route('**/api/reports/invoices**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: MOCK_INVOICE_REPORT,
            meta: MOCK_META,
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/reports/sales')
    await page.waitForLoadState('domcontentloaded')

    // Header
    await expect(page.getByText('Sales Report')).toBeVisible()

    // Date range filter pills should be present
    await expect(page.getByLabel('Date range filter')).toBeVisible()
  })
})

test.describe('Day Book', () => {
  test('renders day book page', async ({ authedPage: page }) => {
    await page.route('**/api/reports/day-book**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: MOCK_DAY_BOOK,
            meta: MOCK_META,
          }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/reports/day-book')
    await page.waitForLoadState('domcontentloaded')

    // Header title
    await expect(page.getByText('Day Book')).toBeVisible()
  })
})

test.describe('Stock Summary', () => {
  test('renders stock summary page', async ({ authedPage: page }) => {
    await page.route('**/api/reports/stock-summary**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: MOCK_STOCK_SUMMARY,
            meta: MOCK_META,
          }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/reports/stock-summary')
    await page.waitForLoadState('domcontentloaded')

    // Header title
    await expect(page.getByText('Stock Summary')).toBeVisible()
  })
})

test.describe('Payment History', () => {
  test('renders payment history page', async ({ authedPage: page }) => {
    await page.route('**/api/reports/payments**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: MOCK_PAYMENT_HISTORY,
            meta: MOCK_META,
          }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/reports/payment-history')
    await page.waitForLoadState('domcontentloaded')

    // Header title
    await expect(page.getByText('Payment History')).toBeVisible()
  })
})
