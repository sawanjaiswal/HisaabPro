/**
 * Payments + Outstanding — E2E Tests
 *
 * Tests the Payments list (/payments) and Outstanding list (/outstanding)
 * pages across viewports: rendering with data, empty states, responsive layout.
 */

import { test, expect, mockApiGet } from './fixtures'
import type { Page } from '@playwright/test'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_PAYMENTS_RESPONSE = {
  payments: [
    {
      id: 'pay_1',
      type: 'PAYMENT_IN' as const,
      partyId: 'p1',
      partyName: 'Sharma Electronics',
      amount: 500000,
      date: '2026-03-15',
      mode: 'UPI' as const,
      referenceNumber: null,
      notes: null,
      allocationsCount: 0,
      hasDiscount: false,
      discountAmount: 0,
      unallocatedAmount: 500000,
      createdAt: '2026-03-15T00:00:00Z',
    },
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  summary: { totalIn: 500000, totalOut: 0, net: 500000 },
}

const MOCK_PAYMENTS_EMPTY = {
  payments: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  summary: { totalIn: 0, totalOut: 0, net: 0 },
}

const MOCK_OUTSTANDING_RESPONSE = {
  parties: [
    {
      partyId: 'p1',
      partyName: 'Sharma Electronics',
      partyPhone: '9876543210',
      partyType: 'CUSTOMER' as const,
      outstanding: 250000,
      type: 'RECEIVABLE' as const,
      invoiceCount: 3,
      oldestDueDate: '2026-02-15',
      daysOverdue: 30,
      lastPaymentDate: '2026-03-01',
      lastReminderDate: null,
      aging: {
        current: 150000,
        days1to30: 50000,
        days31to60: 50000,
        days61to90: 0,
        days90plus: 0,
      },
    },
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  totals: {
    totalReceivable: 250000,
    totalPayable: 0,
    net: 250000,
    overdueReceivable: 100000,
    overduePayable: 0,
  },
  aging: {
    current: 150000,
    days1to30: 50000,
    days31to60: 50000,
    days61to90: 0,
    days90plus: 0,
  },
}

const MOCK_OUTSTANDING_EMPTY = {
  parties: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  totals: {
    totalReceivable: 0,
    totalPayable: 0,
    net: 0,
    overdueReceivable: 0,
    overduePayable: 0,
  },
  aging: {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0,
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Set up API mocks for the payments page with given data */
async function mockPaymentsApi(page: Page, paymentsData: typeof MOCK_PAYMENTS_RESPONSE) {
  await mockApiGet(page, 'payments?*', paymentsData)
  // Also mock without query string in case first load has no params
  await mockApiGet(page, 'payments', paymentsData)
}

/** Set up API mocks for the outstanding page with given data */
async function mockOutstandingApi(page: Page, outstandingData: typeof MOCK_OUTSTANDING_RESPONSE) {
  await mockApiGet(page, 'payments/outstanding/list?*', outstandingData)
  await mockApiGet(page, 'payments/outstanding/list', outstandingData)
}

// ─── Payments List Tests ────────────────────────────────────────────────────

test.describe('Payments Page — /payments', () => {
  test('renders payment list with mocked data', async ({ authedPage }) => {
    await mockPaymentsApi(authedPage, MOCK_PAYMENTS_RESPONSE)
    await authedPage.goto('/payments')

    // Wait for the payment list to render
    const paymentList = authedPage.locator('[role="list"][aria-label="Payments"]')
    await expect(paymentList).toBeVisible()

    // Verify the payment card shows party name
    await expect(authedPage.getByText('Sharma Electronics')).toBeVisible()
  })

  test('shows empty state when no payments', async ({ authedPage }) => {
    await mockPaymentsApi(authedPage, MOCK_PAYMENTS_EMPTY)
    await authedPage.goto('/payments')

    // Empty state renders with descriptive text
    await expect(authedPage.getByText('No payments recorded yet')).toBeVisible()
    await expect(
      authedPage.getByText('Record your first payment to start tracking money in & out'),
    ).toBeVisible()

    // CTA button in empty state
    await expect(
      authedPage.getByRole('button', { name: /record first payment/i }),
    ).toBeVisible()
  })

  test('"Record new payment" FAB is visible', async ({ authedPage }) => {
    await mockPaymentsApi(authedPage, MOCK_PAYMENTS_RESPONSE)
    await authedPage.goto('/payments')

    // The FAB with aria-label "Record new payment"
    const fab = authedPage.getByRole('button', { name: /record new payment/i })
    await expect(fab).toBeVisible()
  })
})

// ─── Outstanding Tests ──────────────────────────────────────────────────────

test.describe('Outstanding Page — /outstanding', () => {
  test('renders outstanding list with mocked data', async ({ authedPage }) => {
    await mockOutstandingApi(authedPage, MOCK_OUTSTANDING_RESPONSE)
    await authedPage.goto('/outstanding')

    // Wait for the outstanding list to render
    const outstandingList = authedPage.locator('[role="list"][aria-label="Outstanding parties"]')
    await expect(outstandingList).toBeVisible()

    // Verify party name appears in the list
    await expect(authedPage.getByText('Sharma Electronics')).toBeVisible()
  })

  test('shows empty state when no outstanding', async ({ authedPage }) => {
    await mockOutstandingApi(authedPage, MOCK_OUTSTANDING_EMPTY)
    await authedPage.goto('/outstanding')

    // Empty state renders
    await expect(authedPage.getByText('All clear! No outstanding.')).toBeVisible()
    await expect(
      authedPage.getByText('When you create invoices, outstanding will show here.'),
    ).toBeVisible()
  })
})

// ─── Responsive Tests ───────────────────────────────────────────────────────

test.describe('Responsive — No Horizontal Scroll on Mobile', () => {
  test('payments page has no horizontal scroll on 375px', async ({ authedPage }) => {
    await authedPage.setViewportSize({ width: 375, height: 812 })
    await mockPaymentsApi(authedPage, MOCK_PAYMENTS_RESPONSE)
    await authedPage.goto('/payments')

    // Wait for content to render
    await expect(
      authedPage.locator('[role="list"][aria-label="Payments"]'),
    ).toBeVisible()

    const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  test('outstanding page has no horizontal scroll on 375px', async ({ authedPage }) => {
    await authedPage.setViewportSize({ width: 375, height: 812 })
    await mockOutstandingApi(authedPage, MOCK_OUTSTANDING_RESPONSE)
    await authedPage.goto('/outstanding')

    // Wait for content to render
    await expect(
      authedPage.locator('[role="list"][aria-label="Outstanding parties"]'),
    ).toBeVisible()

    const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
})
