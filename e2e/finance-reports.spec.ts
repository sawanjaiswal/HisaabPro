/**
 * Finance Reports — E2E tests
 *
 * Covers: Profit & Loss, Balance Sheet, Cash Flow, Aging Report.
 * All API calls mocked via fixtures helpers.
 */

import { test, expect, mockApiGet, mockApiError } from './fixtures'
import type { Page } from '@playwright/test'

// ─── Profit & Loss Mock Data ────────────────────────────────────────────────

const MOCK_PROFIT_LOSS = {
  from: '2026-03-01',
  to: '2026-03-31',
  revenue: {
    label: 'Revenue',
    amount: 15000000,
    items: [
      { label: 'Sales', amount: 12000000 },
      { label: 'Service Income', amount: 3000000 },
    ],
  },
  costOfGoods: {
    label: 'Cost of Goods Sold',
    amount: 8000000,
    items: [
      { label: 'Purchase Cost', amount: 7000000 },
      { label: 'Freight', amount: 1000000 },
    ],
  },
  grossProfit: 7000000,
  expenses: {
    label: 'Operating Expenses',
    amount: 4000000,
    items: [
      { label: 'Rent', amount: 1500000 },
      { label: 'Salary', amount: 2000000 },
      { label: 'Utilities', amount: 500000 },
    ],
  },
  otherIncome: {
    label: 'Other Income',
    amount: 250000,
    items: [
      { label: 'Interest', amount: 250000 },
    ],
  },
  netProfit: 3250000,
}

// ─── Balance Sheet Mock Data ────────────────────────────────────────────────

const MOCK_BALANCE_SHEET = {
  asOf: '2026-03-31',
  assets: {
    label: 'Assets',
    total: 20000000,
    items: [
      { label: 'Cash', amount: 5000000 },
      { label: 'Accounts Receivable', amount: 8000000 },
      { label: 'Inventory', amount: 7000000 },
    ],
  },
  liabilities: {
    label: 'Liabilities',
    total: 12000000,
    items: [
      { label: 'Accounts Payable', amount: 5000000 },
      { label: 'Loan Payable', amount: 7000000 },
    ],
  },
  equity: {
    label: 'Equity',
    total: 8000000,
    items: [
      { label: 'Owner Capital', amount: 5000000 },
      { label: 'Retained Earnings', amount: 3000000 },
    ],
  },
}

// ─── Cash Flow Mock Data ────────────────────────────────────────────────────

const MOCK_CASH_FLOW = {
  from: '2026-03-01',
  to: '2026-03-31',
  operating: {
    label: 'Operating Activities',
    netAmount: 4500000,
    items: [
      { label: 'Collections from Customers', amount: 12000000 },
      { label: 'Payments to Suppliers', amount: -5500000 },
      { label: 'Operating Expenses', amount: -2000000 },
    ],
  },
  investing: {
    label: 'Investing Activities',
    netAmount: -1000000,
    items: [
      { label: 'Equipment Purchase', amount: -1000000 },
    ],
  },
  financing: {
    label: 'Financing Activities',
    netAmount: -500000,
    items: [
      { label: 'Loan Repayment', amount: -500000 },
    ],
  },
  netCashFlow: 3000000,
}

// ─── Aging Report Mock Data ─────────────────────────────────────────────────

const MOCK_AGING_RECEIVABLE = {
  type: 'RECEIVABLE' as const,
  asOf: '2026-03-18',
  rows: [
    { partyId: 'p1', partyName: 'Sharma Electronics', current: 500000, days31to60: 300000, days61to90: 0, over90: 200000, total: 1000000 },
    { partyId: 'p2', partyName: 'Gupta Traders', current: 250000, days31to60: 0, days61to90: 150000, over90: 0, total: 400000 },
  ],
  totals: { current: 750000, days31to60: 300000, days61to90: 150000, over90: 200000, total: 1400000 },
}

const MOCK_AGING_EMPTY = {
  type: 'RECEIVABLE' as const,
  asOf: '2026-03-18',
  rows: [],
  totals: { current: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function mockProfitLoss(page: Page) {
  await mockApiGet(page, 'reports/financial/profit-loss**', MOCK_PROFIT_LOSS)
}

async function mockProfitLossNull(page: Page) {
  await mockApiGet(page, 'reports/financial/profit-loss**', null)
}

async function mockBalanceSheet(page: Page) {
  await mockApiGet(page, 'reports/financial/balance-sheet**', MOCK_BALANCE_SHEET)
}

async function mockBalanceSheetNull(page: Page) {
  await mockApiGet(page, 'reports/financial/balance-sheet**', null)
}

async function mockCashFlow(page: Page) {
  await mockApiGet(page, 'reports/financial/cash-flow**', MOCK_CASH_FLOW)
}

async function mockCashFlowNull(page: Page) {
  await mockApiGet(page, 'reports/financial/cash-flow**', null)
}

async function mockAgingReceivable(page: Page) {
  await mockApiGet(page, 'reports/financial/aging**', MOCK_AGING_RECEIVABLE)
}

async function mockAgingEmpty(page: Page) {
  await mockApiGet(page, 'reports/financial/aging**', MOCK_AGING_EMPTY)
}

// ─── Profit & Loss Tests ────────────────────────────────────────────────────

test.describe('Profit & Loss Report', () => {
  test('renders P&L with revenue, expenses, and net profit', async ({ authedPage }) => {
    await mockProfitLoss(authedPage)
    await authedPage.goto('/reports/profit-loss')

    await expect(authedPage.getByText('Profit & Loss')).toBeVisible()
    await expect(authedPage.getByText('Revenue')).toBeVisible()
    await expect(authedPage.getByText('Operating Expenses')).toBeVisible()
    await expect(authedPage.getByText('Gross Profit')).toBeVisible()
    await expect(authedPage.getByText(/Net Profit/)).toBeVisible()
  })

  test('shows revenue line items', async ({ authedPage }) => {
    await mockProfitLoss(authedPage)
    await authedPage.goto('/reports/profit-loss')

    await expect(authedPage.getByText('Sales')).toBeVisible()
    await expect(authedPage.getByText('Service Income')).toBeVisible()
  })

  test('shows expense line items', async ({ authedPage }) => {
    await mockProfitLoss(authedPage)
    await authedPage.goto('/reports/profit-loss')

    await expect(authedPage.getByText('Rent')).toBeVisible()
    await expect(authedPage.getByText('Salary')).toBeVisible()
    await expect(authedPage.getByText('Utilities')).toBeVisible()
  })

  test('shows loading skeleton', async ({ authedPage }) => {
    await authedPage.route('**/api/reports/financial/profit-loss**', (route) =>
      setTimeout(() => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_PROFIT_LOSS }),
      }), 2000),
    )
    await authedPage.goto('/reports/profit-loss')

    const skeleton = authedPage.locator('[aria-busy="true"]')
    await expect(skeleton).toBeVisible()
  })

  test('shows error state with retry', async ({ authedPage }) => {
    await mockApiError(authedPage, 'reports/financial/profit-loss**')
    await authedPage.goto('/reports/profit-loss')

    await expect(authedPage.getByText(/Could not load P&L/)).toBeVisible()
    await expect(authedPage.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('shows empty state when no data', async ({ authedPage }) => {
    await mockProfitLossNull(authedPage)
    await authedPage.goto('/reports/profit-loss')

    await expect(authedPage.getByText('No data for this period')).toBeVisible()
    await expect(authedPage.getByText(/different date range/)).toBeVisible()
  })

  test('date range inputs are visible', async ({ authedPage }) => {
    await mockProfitLoss(authedPage)
    await authedPage.goto('/reports/profit-loss')

    await expect(authedPage.getByLabel('From date')).toBeVisible()
    await expect(authedPage.getByLabel('To date')).toBeVisible()
    await expect(authedPage.getByLabel('Refresh report')).toBeVisible()
  })
})

// ─── Balance Sheet Tests ────────────────────────────────────────────────────

test.describe('Balance Sheet Report', () => {
  test('renders balance sheet with sections', async ({ authedPage }) => {
    await mockBalanceSheet(authedPage)
    await authedPage.goto('/reports/balance-sheet')

    await expect(authedPage.getByRole('heading', { name: 'Balance Sheet' })).toBeVisible()
    await expect(authedPage.getByText('Assets', { exact: true })).toBeVisible()
    await expect(authedPage.getByText('Liabilities', { exact: true })).toBeVisible()
    await expect(authedPage.getByText('Equity', { exact: true })).toBeVisible()
  })

  test('shows asset line items', async ({ authedPage }) => {
    await mockBalanceSheet(authedPage)
    await authedPage.goto('/reports/balance-sheet')

    await expect(authedPage.getByText('Cash')).toBeVisible()
    await expect(authedPage.getByText('Accounts Receivable')).toBeVisible()
    await expect(authedPage.getByText('Inventory')).toBeVisible()
  })

  test('shows total assets row', async ({ authedPage }) => {
    await mockBalanceSheet(authedPage)
    await authedPage.goto('/reports/balance-sheet')

    await expect(authedPage.getByText('Total Assets')).toBeVisible()
  })

  test('shows loading skeleton', async ({ authedPage }) => {
    await authedPage.route('**/api/reports/financial/balance-sheet**', (route) =>
      setTimeout(() => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_BALANCE_SHEET }),
      }), 2000),
    )
    await authedPage.goto('/reports/balance-sheet')

    const skeleton = authedPage.locator('[aria-busy="true"]')
    await expect(skeleton).toBeVisible()
  })

  test('shows error state with retry', async ({ authedPage }) => {
    await mockApiError(authedPage, 'reports/financial/balance-sheet**')
    await authedPage.goto('/reports/balance-sheet')

    await expect(authedPage.getByText(/Could not load balance sheet/)).toBeVisible()
    await expect(authedPage.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('shows empty state when no data', async ({ authedPage }) => {
    await mockBalanceSheetNull(authedPage)
    await authedPage.goto('/reports/balance-sheet')

    await expect(authedPage.getByText('No data for this date')).toBeVisible()
  })

  test('as-of date input is visible', async ({ authedPage }) => {
    await mockBalanceSheet(authedPage)
    await authedPage.goto('/reports/balance-sheet')

    await expect(authedPage.getByLabel('As of date')).toBeVisible()
    await expect(authedPage.getByLabel('Refresh balance sheet')).toBeVisible()
  })
})

// ─── Cash Flow Tests ────────────────────────────────────────────────────────

test.describe('Cash Flow Report', () => {
  test('renders cash flow with all sections', async ({ authedPage }) => {
    await mockCashFlow(authedPage)
    await authedPage.goto('/reports/cash-flow')

    await expect(authedPage.getByRole('heading', { name: /Cash Flow/ })).toBeVisible()
    await expect(authedPage.getByText('Operating Activities')).toBeVisible()
    await expect(authedPage.getByText('Investing Activities')).toBeVisible()
    await expect(authedPage.getByText('Financing Activities')).toBeVisible()
    await expect(authedPage.getByText('Net Cash Flow')).toBeVisible()
  })

  test('shows operating activity line items', async ({ authedPage }) => {
    await mockCashFlow(authedPage)
    await authedPage.goto('/reports/cash-flow')

    await expect(authedPage.getByText('Collections from Customers')).toBeVisible()
    await expect(authedPage.getByText('Payments to Suppliers')).toBeVisible()
  })

  test('shows loading skeleton', async ({ authedPage }) => {
    await authedPage.route('**/api/reports/financial/cash-flow**', (route) =>
      setTimeout(() => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_CASH_FLOW }),
      }), 2000),
    )
    await authedPage.goto('/reports/cash-flow')

    const skeleton = authedPage.locator('[aria-busy="true"]')
    await expect(skeleton).toBeVisible()
  })

  test('shows error state with retry', async ({ authedPage }) => {
    await mockApiError(authedPage, 'reports/financial/cash-flow**')
    await authedPage.goto('/reports/cash-flow')

    await expect(authedPage.getByText(/Could not load cash flow/)).toBeVisible()
    await expect(authedPage.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('shows empty state when no data', async ({ authedPage }) => {
    await mockCashFlowNull(authedPage)
    await authedPage.goto('/reports/cash-flow')

    await expect(authedPage.getByText('No data for this period')).toBeVisible()
  })

  test('date range inputs are visible', async ({ authedPage }) => {
    await mockCashFlow(authedPage)
    await authedPage.goto('/reports/cash-flow')

    await expect(authedPage.getByLabel('From date')).toBeVisible()
    await expect(authedPage.getByLabel('To date')).toBeVisible()
    await expect(authedPage.getByLabel('Refresh cash flow')).toBeVisible()
  })
})

// ─── Aging Report Tests ─────────────────────────────────────────────────────

test.describe('Aging Report', () => {
  test('renders aging table with party rows', async ({ authedPage }) => {
    await mockAgingReceivable(authedPage)
    await authedPage.goto('/reports/aging')

    await expect(authedPage.getByText('Aging Report')).toBeVisible()
    await expect(authedPage.getByText('Sharma Electronics')).toBeVisible()
    await expect(authedPage.getByText('Gupta Traders')).toBeVisible()
  })

  test('shows table headers for aging buckets', async ({ authedPage }) => {
    await mockAgingReceivable(authedPage)
    await authedPage.goto('/reports/aging')

    await expect(authedPage.getByRole('columnheader', { name: 'Party' })).toBeVisible()
    await expect(authedPage.getByRole('columnheader', { name: 'Current' })).toBeVisible()
    await expect(authedPage.getByRole('columnheader', { name: '31-60 days' })).toBeVisible()
    await expect(authedPage.getByRole('columnheader', { name: '61-90 days' })).toBeVisible()
    await expect(authedPage.getByRole('columnheader', { name: 'Over 90' })).toBeVisible()
    await expect(authedPage.getByRole('columnheader', { name: 'Total' })).toBeVisible()
  })

  test('shows total row', async ({ authedPage }) => {
    await mockAgingReceivable(authedPage)
    await authedPage.goto('/reports/aging')

    // Total row in the table
    const totalCell = authedPage.locator('.aging-table__total td').first()
    await expect(totalCell).toHaveText('Total')
  })

  test('receivable/payable tabs are visible', async ({ authedPage }) => {
    await mockAgingReceivable(authedPage)
    await authedPage.goto('/reports/aging')

    await expect(authedPage.getByRole('button', { name: 'Receivable' })).toBeVisible()
    await expect(authedPage.getByRole('button', { name: 'Payable' })).toBeVisible()
  })

  test('shows loading skeleton', async ({ authedPage }) => {
    await authedPage.route('**/api/reports/financial/aging**', (route) =>
      setTimeout(() => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_AGING_RECEIVABLE }),
      }), 2000),
    )
    await authedPage.goto('/reports/aging')

    const skeleton = authedPage.locator('[aria-busy="true"]')
    await expect(skeleton).toBeVisible()
  })

  test('shows error state with retry', async ({ authedPage }) => {
    await mockApiError(authedPage, 'reports/financial/aging**')
    await authedPage.goto('/reports/aging')

    await expect(authedPage.getByText(/Could not load aging report/)).toBeVisible()
    await expect(authedPage.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('shows empty state when no outstanding', async ({ authedPage }) => {
    await mockAgingEmpty(authedPage)
    await authedPage.goto('/reports/aging')

    await expect(authedPage.getByText(/No outstanding receivables/)).toBeVisible()
    await expect(authedPage.getByText(/All balances are settled/)).toBeVisible()
  })

  test('refresh button is visible', async ({ authedPage }) => {
    await mockAgingReceivable(authedPage)
    await authedPage.goto('/reports/aging')

    await expect(authedPage.getByLabel('Refresh aging report')).toBeVisible()
  })
})

// ─── Responsive Tests ───────────────────────────────────────────────────────

const MOBILE_VIEWPORTS = [
  { name: 'iPhone 14', width: 375, height: 812 },
  { name: 'iPhone SE', width: 320, height: 568 },
]

for (const vp of MOBILE_VIEWPORTS) {
  test.describe(`Responsive — ${vp.name} (${vp.width}px)`, () => {
    test(`P&L: no horizontal scroll on ${vp.width}px`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: vp.width, height: vp.height })
      await mockProfitLoss(authedPage)
      await authedPage.goto('/reports/profit-loss')

      await expect(authedPage.getByText('Revenue')).toBeVisible()
      const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })

    test(`balance sheet: no horizontal scroll on ${vp.width}px`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: vp.width, height: vp.height })
      await mockBalanceSheet(authedPage)
      await authedPage.goto('/reports/balance-sheet')

      await expect(authedPage.getByText('Assets', { exact: true })).toBeVisible()
      const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })

    test(`cash flow: no horizontal scroll on ${vp.width}px`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: vp.width, height: vp.height })
      await mockCashFlow(authedPage)
      await authedPage.goto('/reports/cash-flow')

      await expect(authedPage.getByText('Operating Activities')).toBeVisible()
      const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })

    test(`aging report: no horizontal scroll on ${vp.width}px`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: vp.width, height: vp.height })
      await mockAgingReceivable(authedPage)
      await authedPage.goto('/reports/aging')

      await expect(authedPage.getByText('Aging Report')).toBeVisible()
      const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })
  })
}
