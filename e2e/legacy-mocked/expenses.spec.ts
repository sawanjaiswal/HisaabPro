/**
 * Expenses feature — E2E tests
 *
 * Covers: expense list, category filters, add drawer, pagination.
 * All API calls mocked via fixtures helpers.
 */

import { test, expect, mockApiGet, mockApiError } from './fixtures'
import type { Page } from '@playwright/test'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_CATEGORIES = [
  { id: 'cat_1', businessId: 'biz_test_001', name: 'Rent', icon: null, color: null, isSystem: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cat_2', businessId: 'biz_test_001', name: 'Salary', icon: null, color: null, isSystem: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cat_3', businessId: 'biz_test_001', name: 'Transport', icon: null, color: null, isSystem: false, createdAt: '2026-02-15T00:00:00Z' },
]

const MOCK_EXPENSES = {
  items: [
    {
      id: 'exp_1', businessId: 'biz_test_001', categoryId: 'cat_1', categoryName: 'Rent',
      amount: 1500000, date: '2026-03-15', paymentMode: 'BANK_TRANSFER' as const,
      notes: 'Office rent March', referenceNumber: 'TXN-001', partyId: null, partyName: null,
      createdAt: '2026-03-15T10:00:00Z', updatedAt: '2026-03-15T10:00:00Z',
    },
    {
      id: 'exp_2', businessId: 'biz_test_001', categoryId: 'cat_2', categoryName: 'Salary',
      amount: 2500000, date: '2026-03-16', paymentMode: 'UPI' as const,
      notes: 'Staff salary', referenceNumber: null, partyId: null, partyName: null,
      createdAt: '2026-03-16T10:00:00Z', updatedAt: '2026-03-16T10:00:00Z',
    },
    {
      id: 'exp_3', businessId: 'biz_test_001', categoryId: 'cat_3', categoryName: 'Transport',
      amount: 50000, date: '2026-03-17', paymentMode: 'CASH' as const,
      notes: null, referenceNumber: null, partyId: null, partyName: null,
      createdAt: '2026-03-17T10:00:00Z', updatedAt: '2026-03-17T10:00:00Z',
    },
  ],
  total: 3,
  page: 1,
  limit: 20,
}

const MOCK_EXPENSES_EMPTY = {
  items: [],
  total: 0,
  page: 1,
  limit: 20,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function mockExpensesList(page: Page) {
  await mockApiGet(page, 'expenses*', MOCK_EXPENSES)
  await mockApiGet(page, 'expenses/categories', MOCK_CATEGORIES)
}

async function mockExpensesEmpty(page: Page) {
  await mockApiGet(page, 'expenses*', MOCK_EXPENSES_EMPTY)
  await mockApiGet(page, 'expenses/categories', MOCK_CATEGORIES)
}

// ─── List Page Tests ────────────────────────────────────────────────────────

test.describe('Expenses — List Page', () => {
  test('renders expense list with items', async ({ authedPage }) => {
    await mockExpensesList(authedPage)
    await authedPage.goto('/expenses')

    await expect(authedPage.getByRole('heading', { name: 'Expenses' })).toBeVisible()
    // Category names appear in both filter pills and cards — use first match
    await expect(authedPage.getByText('Rent').first()).toBeVisible()
    await expect(authedPage.getByText('Salary').first()).toBeVisible()
    await expect(authedPage.getByText('3 expenses')).toBeVisible()
  })

  test('shows loading skeleton on initial load', async ({ authedPage }) => {
    await authedPage.route('**/api/expenses?**', (route) =>
      setTimeout(() => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_EXPENSES }),
      }), 2000),
    )
    await mockApiGet(authedPage, 'expenses/categories', MOCK_CATEGORIES)
    await authedPage.goto('/expenses')

    // Should show loading skeleton, not blank page
    const skeleton = authedPage.locator('[aria-busy="true"]')
    await expect(skeleton).toBeVisible()
  })

  test('shows error state with retry button', async ({ authedPage }) => {
    await mockApiError(authedPage, 'expenses*')
    await mockApiGet(authedPage, 'expenses/categories', MOCK_CATEGORIES)
    await authedPage.goto('/expenses')

    await expect(authedPage.getByText('Could not load expenses')).toBeVisible()
    await expect(authedPage.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('shows empty state when no expenses', async ({ authedPage }) => {
    await mockExpensesEmpty(authedPage)
    await authedPage.goto('/expenses')

    await expect(authedPage.getByText('No expenses recorded')).toBeVisible()
    await expect(authedPage.getByText(/tracking your business expenses/)).toBeVisible()
    await expect(authedPage.getByText('Record First Expense')).toBeVisible()
  })

  test('category filter pills are visible', async ({ authedPage }) => {
    await mockExpensesList(authedPage)
    await authedPage.goto('/expenses')

    const filterBar = authedPage.getByRole('group', { name: /Filter by category/ })
    await expect(filterBar).toBeVisible()

    // All pill should be active by default (use aria-pressed attribute)
    const allPill = filterBar.getByRole('button', { name: 'All', pressed: true })
    await expect(allPill).toBeVisible()
  })

  test('add expense button is visible', async ({ authedPage }) => {
    await mockExpensesList(authedPage)
    await authedPage.goto('/expenses')

    await expect(authedPage.getByLabel('Add expense')).toBeVisible()
  })

  test('clicking add expense opens drawer', async ({ authedPage }) => {
    await mockExpensesList(authedPage)
    await authedPage.goto('/expenses')

    await authedPage.getByLabel('Add expense').click()

    // Drawer heading should be visible
    await expect(authedPage.getByRole('heading', { name: 'Add Expense' })).toBeVisible()
  })
})

// ─── Responsive Tests ───────────────────────────────────────────────────────

const MOBILE_VIEWPORTS = [
  { name: 'iPhone 14', width: 375, height: 812 },
  { name: 'iPhone SE', width: 320, height: 568 },
]

for (const vp of MOBILE_VIEWPORTS) {
  test.describe(`Responsive — ${vp.name} (${vp.width}px)`, () => {
    test(`expenses list: no horizontal scroll on ${vp.width}px`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: vp.width, height: vp.height })
      await mockExpensesList(authedPage)
      await authedPage.goto('/expenses')

      await expect(authedPage.getByText('Rent').first()).toBeVisible()
      const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })

    test(`expenses empty state: no horizontal scroll on ${vp.width}px`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: vp.width, height: vp.height })
      await mockExpensesEmpty(authedPage)
      await authedPage.goto('/expenses')

      await expect(authedPage.getByText('No expenses recorded')).toBeVisible()
      const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })
  })
}
