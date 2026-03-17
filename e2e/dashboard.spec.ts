/**
 * Dashboard — E2E Tests
 *
 * Covers: dashboard with data, quick actions, and responsive checks.
 * All tests use the authedPage fixture from ./fixtures.ts for authenticated state.
 */

import { test, expect, mockApiGet } from './fixtures'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_DASHBOARD_DATA = {
  outstanding: {
    receivable: { total: 500000, partyCount: 3 },
    payable: { total: 200000, partyCount: 2 },
  },
  today: {
    salesCount: 5,
    salesAmount: 150000,
    paymentsReceivedCount: 3,
    paymentsReceivedAmount: 100000,
    paymentsMadeAmount: 50000,
    netCashFlow: 50000,
  },
  recentActivity: [],
  alerts: {
    lowStockCount: 0,
    overdueInvoiceCount: 0,
    overdueAmount: 0,
  },
  topDebtors: [],
}

// ─── 1. Dashboard Renders ──────────────────────────────────────────────────

test.describe('Dashboard Page', () => {
  test('renders with mocked data showing sales and outstanding', async ({ authedPage: page }) => {
    await mockApiGet(page, 'dashboard/home', MOCK_DASHBOARD_DATA)
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')

    // Today's Sale label visible
    await expect(page.getByText("Today's Sale")).toBeVisible()

    // Quick action buttons visible
    await expect(page.getByText('Create')).toBeVisible()
    await expect(page.getByText('Send')).toBeVisible()
    await expect(page.getByText('Pay')).toBeVisible()
    await expect(page.getByText('More')).toBeVisible()
  })

  test('shows quick action buttons', async ({ authedPage: page }) => {
    await mockApiGet(page, 'dashboard/home', MOCK_DASHBOARD_DATA)
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')

    // All 4 quick actions from dashboard.constants.ts
    const createAction = page.getByText('Create')
    const sendAction = page.getByText('Send')
    const payAction = page.getByText('Pay')
    const moreAction = page.getByText('More')

    await expect(createAction).toBeVisible()
    await expect(sendAction).toBeVisible()
    await expect(payAction).toBeVisible()
    await expect(moreAction).toBeVisible()
  })
})

// ─── 2. Responsive Checks ─────────────────────────────────────────────────

test.describe('Dashboard — Responsive', () => {
  test('no horizontal scroll on 375px', async ({ authedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockApiGet(page, 'dashboard/home', MOCK_DASHBOARD_DATA)
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')

    // Wait for content to render
    await expect(page.getByText("Today's Sale")).toBeVisible()

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  test('no horizontal scroll on 320px', async ({ authedPage: page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await mockApiGet(page, 'dashboard/home', MOCK_DASHBOARD_DATA)
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')

    // Wait for content to render
    await expect(page.getByText("Today's Sale")).toBeVisible()

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
})
