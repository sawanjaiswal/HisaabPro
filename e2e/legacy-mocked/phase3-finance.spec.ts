/**
 * Phase 3 Finance features — E2E tests
 *
 * Covers: Loans, Cheques, Bank Accounts, Other Income.
 * All API calls mocked via fixtures helpers.
 */

import { test, expect, mockApiGet, mockApiError } from './fixtures'
import type { Page } from '@playwright/test'

// ─── Loans Mock Data ────────────────────────────────────────────────────────

const MOCK_LOANS = {
  items: [
    {
      id: 'loan_1', businessId: 'biz_test_001', loanType: 'TAKEN' as const,
      partyId: 'p1', partyName: 'HDFC Bank',
      principalAmount: 50000000, outstandingAmount: 35000000,
      interestRate: 12.5, emiAmount: 500000,
      startDate: '2026-01-01', endDate: null, nextPaymentDate: '2026-04-01',
      status: 'ACTIVE' as const, notes: 'Business loan',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-03-15T00:00:00Z',
    },
    {
      id: 'loan_2', businessId: 'biz_test_001', loanType: 'GIVEN' as const,
      partyId: 'p2', partyName: 'Raju Traders',
      principalAmount: 10000000, outstandingAmount: 10000000,
      interestRate: 0, emiAmount: null,
      startDate: '2026-02-15', endDate: null, nextPaymentDate: null,
      status: 'ACTIVE' as const, notes: null,
      createdAt: '2026-02-15T00:00:00Z', updatedAt: '2026-02-15T00:00:00Z',
    },
  ],
  total: 2,
}

const MOCK_LOANS_EMPTY = { items: [], total: 0 }

// ─── Cheques Mock Data ──────────────────────────────────────────────────────

const MOCK_CHEQUES = {
  items: [
    {
      id: 'chq_1', businessId: 'biz_test_001', chequeNumber: 'CHQ-001234',
      bankName: 'SBI', accountNumber: '12345678901',
      type: 'RECEIVED' as const, status: 'PENDING' as const,
      amount: 5000000, chequeDate: '2026-03-15', dueDate: '2026-03-20',
      partyId: 'p1', partyName: 'Sharma Electronics',
      notes: null, clearedAt: null, bouncedAt: null,
      createdAt: '2026-03-15T10:00:00Z', updatedAt: '2026-03-15T10:00:00Z',
    },
    {
      id: 'chq_2', businessId: 'biz_test_001', chequeNumber: 'CHQ-005678',
      bankName: 'HDFC', accountNumber: '98765432101',
      type: 'ISSUED' as const, status: 'CLEARED' as const,
      amount: 3000000, chequeDate: '2026-03-10', dueDate: null,
      partyId: 'p2', partyName: 'Gupta Traders',
      notes: 'Payment for goods', clearedAt: '2026-03-12T00:00:00Z', bouncedAt: null,
      createdAt: '2026-03-10T10:00:00Z', updatedAt: '2026-03-12T10:00:00Z',
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
}

const MOCK_CHEQUES_EMPTY = { items: [], total: 0, page: 1, limit: 20 }

// ─── Bank Accounts Mock Data ────────────────────────────────────────────────

const MOCK_BANK_ACCOUNTS = {
  items: [
    {
      id: 'ba_1', businessId: 'biz_test_001', bankName: 'SBI',
      accountNumber: '12345678901', accountHolderName: 'Test User',
      ifscCode: 'SBIN0001234', accountType: 'CURRENT' as const,
      openingBalance: 10000000, currentBalance: 15000000,
      isDefault: true, isActive: true,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-03-15T00:00:00Z',
    },
    {
      id: 'ba_2', businessId: 'biz_test_001', bankName: 'HDFC',
      accountNumber: '98765432101', accountHolderName: 'Test User',
      ifscCode: 'HDFC0004567', accountType: 'SAVINGS' as const,
      openingBalance: 5000000, currentBalance: 7500000,
      isDefault: false, isActive: true,
      createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-03-15T00:00:00Z',
    },
  ],
  total: 2,
}

const MOCK_BANK_ACCOUNTS_EMPTY = { items: [], total: 0 }

// ─── Other Income Mock Data ─────────────────────────────────────────────────

const MOCK_OTHER_INCOME = {
  items: [
    {
      id: 'oi_1', businessId: 'biz_test_001', category: 'Interest',
      amount: 250000, date: '2026-03-15', paymentMode: 'BANK_TRANSFER' as const,
      notes: 'FD interest', referenceNumber: 'INT-001',
      createdAt: '2026-03-15T10:00:00Z', updatedAt: '2026-03-15T10:00:00Z',
    },
    {
      id: 'oi_2', businessId: 'biz_test_001', category: 'Rental',
      amount: 800000, date: '2026-03-16', paymentMode: 'UPI' as const,
      notes: null, referenceNumber: null,
      createdAt: '2026-03-16T10:00:00Z', updatedAt: '2026-03-16T10:00:00Z',
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
}

const MOCK_OTHER_INCOME_EMPTY = { items: [], total: 0, page: 1, limit: 20 }

// ─── Helpers ────────────────────────────────────────────────────────────────

async function mockLoansList(page: Page) {
  await mockApiGet(page, 'loans', MOCK_LOANS)
}
async function mockLoansEmpty(page: Page) {
  await mockApiGet(page, 'loans', MOCK_LOANS_EMPTY)
}
async function mockChequesList(page: Page) {
  await mockApiGet(page, 'cheques**', MOCK_CHEQUES)
}
async function mockChequesEmpty(page: Page) {
  await mockApiGet(page, 'cheques**', MOCK_CHEQUES_EMPTY)
}
async function mockBankAccountsList(page: Page) {
  await mockApiGet(page, 'bank-accounts', MOCK_BANK_ACCOUNTS)
}
async function mockBankAccountsEmpty(page: Page) {
  await mockApiGet(page, 'bank-accounts', MOCK_BANK_ACCOUNTS_EMPTY)
}
async function mockOtherIncomeList(page: Page) {
  await mockApiGet(page, 'other-income?**', MOCK_OTHER_INCOME)
}
async function mockOtherIncomeEmpty(page: Page) {
  await mockApiGet(page, 'other-income?**', MOCK_OTHER_INCOME_EMPTY)
}

// ─── Loans Tests ────────────────────────────────────────────────────────────

test.describe('Loans — List Page', () => {
  test('renders loan list with items', async ({ authedPage }) => {
    await mockLoansList(authedPage)
    await authedPage.goto('/loans')

    await expect(authedPage.getByRole('heading', { name: 'Loans' })).toBeVisible()
    await expect(authedPage.getByText('HDFC Bank')).toBeVisible()
    await expect(authedPage.getByText('Raju Traders')).toBeVisible()
    await expect(authedPage.getByText('2 loans')).toBeVisible()
  })

  test('shows loan type labels', async ({ authedPage }) => {
    await mockLoansList(authedPage)
    await authedPage.goto('/loans')

    await expect(authedPage.getByText('Loan Taken')).toBeVisible()
    await expect(authedPage.getByText('Loan Given')).toBeVisible()
  })

  test('shows loading skeleton', async ({ authedPage }) => {
    await authedPage.route('**/api/loans', (route) => {
      if (route.request().method() === 'GET') {
        setTimeout(() => route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_LOANS }),
        }), 2000)
      } else {
        route.continue()
      }
    })
    await authedPage.goto('/loans')

    const skeleton = authedPage.locator('[aria-busy="true"]')
    await expect(skeleton).toBeVisible()
  })

  test('shows error state with retry', async ({ authedPage }) => {
    await mockApiError(authedPage, 'loans')
    await authedPage.goto('/loans')

    await expect(authedPage.getByText('Could not load loans')).toBeVisible()
    await expect(authedPage.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('shows empty state when no loans', async ({ authedPage }) => {
    await mockLoansEmpty(authedPage)
    await authedPage.goto('/loans')

    await expect(authedPage.getByText('No loans added')).toBeVisible()
    await expect(authedPage.getByText(/Track loans taken/)).toBeVisible()
    await expect(authedPage.getByText('Add First Loan')).toBeVisible()
  })

  test('add loan button opens drawer', async ({ authedPage }) => {
    await mockLoansList(authedPage)
    await authedPage.goto('/loans')

    await authedPage.getByLabel('Add loan').click()
    await expect(authedPage.getByRole('heading', { name: 'Add Loan' })).toBeVisible()
    await expect(authedPage.getByLabel('Loan Type')).toBeVisible()
    await expect(authedPage.getByLabel(/Principal/)).toBeVisible()
  })
})

// ─── Cheques Tests ──────────────────────────────────────────────────────────

test.describe('Cheques — List Page', () => {
  test('renders cheque list with items', async ({ authedPage }) => {
    await mockChequesList(authedPage)
    await authedPage.goto('/cheques')

    await expect(authedPage.getByRole('heading', { name: 'Cheques' })).toBeVisible()
    await expect(authedPage.getByText('CHQ-001234')).toBeVisible()
    await expect(authedPage.getByText('CHQ-005678')).toBeVisible()
    await expect(authedPage.getByText('2 cheques')).toBeVisible()
  })

  test('shows loading skeleton', async ({ authedPage }) => {
    await authedPage.route('**/api/cheques**', (route) => {
      if (route.request().method() === 'GET') {
        setTimeout(() => route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_CHEQUES }),
        }), 2000)
      } else {
        route.continue()
      }
    })
    await authedPage.goto('/cheques')

    const skeleton = authedPage.locator('[aria-busy="true"]')
    await expect(skeleton).toBeVisible()
  })

  test('shows error state with retry', async ({ authedPage }) => {
    await mockApiError(authedPage, 'cheques**')
    await authedPage.goto('/cheques')

    await expect(authedPage.getByText('Could not load cheques')).toBeVisible()
    await expect(authedPage.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('shows empty state when no cheques', async ({ authedPage }) => {
    await mockChequesEmpty(authedPage)
    await authedPage.goto('/cheques')

    await expect(authedPage.getByText('No cheques recorded')).toBeVisible()
    await expect(authedPage.getByText(/Track cheques received/)).toBeVisible()
    await expect(authedPage.getByText('Add First Cheque')).toBeVisible()
  })

  test('filter pills are visible', async ({ authedPage }) => {
    await mockChequesList(authedPage)
    await authedPage.goto('/cheques')

    const filterBar = authedPage.getByRole('group', { name: /Filter by status/ })
    await expect(filterBar).toBeVisible()
  })

  test('add cheque button opens drawer', async ({ authedPage }) => {
    await mockChequesList(authedPage)
    await authedPage.goto('/cheques')

    await authedPage.getByLabel('Add cheque').click()
    await expect(authedPage.getByRole('heading', { name: 'Add Cheque' })).toBeVisible()
  })
})

// ─── Bank Accounts Tests ────────────────────────────────────────────────────

test.describe('Bank Accounts — List Page', () => {
  test('renders bank account list with items', async ({ authedPage }) => {
    await mockBankAccountsList(authedPage)
    await authedPage.goto('/bank-accounts')

    await expect(authedPage.getByText('Bank Accounts')).toBeVisible()
    await expect(authedPage.getByText('SBI')).toBeVisible()
    await expect(authedPage.getByText('HDFC')).toBeVisible()
    await expect(authedPage.getByText('2 accounts')).toBeVisible()
  })

  test('shows default badge on default account', async ({ authedPage }) => {
    await mockBankAccountsList(authedPage)
    await authedPage.goto('/bank-accounts')

    await expect(authedPage.getByText('Default')).toBeVisible()
  })

  test('shows masked account numbers', async ({ authedPage }) => {
    await mockBankAccountsList(authedPage)
    await authedPage.goto('/bank-accounts')

    // 12345678901 -> xxxx 8901
    await expect(authedPage.getByText('xxxx 8901')).toBeVisible()
    await expect(authedPage.getByText('xxxx 2101')).toBeVisible()
  })

  test('shows loading skeleton', async ({ authedPage }) => {
    await authedPage.route('**/api/bank-accounts', (route) => {
      if (route.request().method() === 'GET') {
        setTimeout(() => route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_BANK_ACCOUNTS }),
        }), 2000)
      } else {
        route.continue()
      }
    })
    await authedPage.goto('/bank-accounts')

    const skeleton = authedPage.locator('[aria-busy="true"]')
    await expect(skeleton).toBeVisible()
  })

  test('shows error state with retry', async ({ authedPage }) => {
    await mockApiError(authedPage, 'bank-accounts')
    await authedPage.goto('/bank-accounts')

    await expect(authedPage.getByText('Could not load bank accounts')).toBeVisible()
    await expect(authedPage.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('shows empty state when no accounts', async ({ authedPage }) => {
    await mockBankAccountsEmpty(authedPage)
    await authedPage.goto('/bank-accounts')

    await expect(authedPage.getByText('No bank accounts added')).toBeVisible()
    await expect(authedPage.getByText(/track balances/)).toBeVisible()
    await expect(authedPage.getByText('Add First Account')).toBeVisible()
  })

  test('add account button opens drawer', async ({ authedPage }) => {
    await mockBankAccountsList(authedPage)
    await authedPage.goto('/bank-accounts')

    await authedPage.getByLabel('Add bank account').click()
    await expect(authedPage.getByRole('heading', { name: 'Add Bank Account' })).toBeVisible()
    await expect(authedPage.getByLabel('Bank Name')).toBeVisible()
    await expect(authedPage.getByLabel('Account Number')).toBeVisible()
  })
})

// ─── Other Income Tests ─────────────────────────────────────────────────────

test.describe('Other Income — List Page', () => {
  test('renders other income list with items', async ({ authedPage }) => {
    await mockOtherIncomeList(authedPage)
    await authedPage.goto('/other-income')

    await expect(authedPage.getByRole('heading', { name: 'Other Income' })).toBeVisible()
    // Category names appear in filter pills and cards — use first()
    await expect(authedPage.getByText('Interest').first()).toBeVisible()
    await expect(authedPage.getByText('Rental').first()).toBeVisible()
    await expect(authedPage.getByText('2 entries')).toBeVisible()
  })

  test('shows loading skeleton', async ({ authedPage }) => {
    await authedPage.route('**/api/other-income?**', (route) => {
      if (route.request().method() === 'GET') {
        setTimeout(() => route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_OTHER_INCOME }),
        }), 2000)
      } else {
        route.continue()
      }
    })
    await authedPage.goto('/other-income')

    const skeleton = authedPage.locator('[aria-busy="true"]')
    await expect(skeleton).toBeVisible()
  })

  test('shows error state with retry', async ({ authedPage }) => {
    await mockApiError(authedPage, 'other-income?**')
    await authedPage.goto('/other-income')

    await expect(authedPage.getByText('Could not load income entries')).toBeVisible()
    await expect(authedPage.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('shows empty state when no income', async ({ authedPage }) => {
    await mockOtherIncomeEmpty(authedPage)
    await authedPage.goto('/other-income')

    await expect(authedPage.getByText('No other income recorded')).toBeVisible()
    await expect(authedPage.getByText(/interest, rent, commissions/)).toBeVisible()
    await expect(authedPage.getByText('Add First Entry')).toBeVisible()
  })

  test('category filter pills are visible', async ({ authedPage }) => {
    await mockOtherIncomeList(authedPage)
    await authedPage.goto('/other-income')

    const filterBar = authedPage.getByRole('group', { name: /Filter by category/ })
    await expect(filterBar).toBeVisible()
  })

  test('add income button opens drawer', async ({ authedPage }) => {
    await mockOtherIncomeList(authedPage)
    await authedPage.goto('/other-income')

    await authedPage.getByLabel('Add income entry').click()
    await expect(authedPage.getByRole('heading', { name: 'Add Other Income' })).toBeVisible()
    await expect(authedPage.getByLabel(/Amount/)).toBeVisible()
  })
})

// ─── Responsive Tests ───────────────────────────────────────────────────────

const MOBILE_VIEWPORTS = [
  { name: 'iPhone 14', width: 375, height: 812 },
  { name: 'iPhone SE', width: 320, height: 568 },
]

for (const vp of MOBILE_VIEWPORTS) {
  test.describe(`Responsive — ${vp.name} (${vp.width}px)`, () => {
    test(`loans: no horizontal scroll on ${vp.width}px`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: vp.width, height: vp.height })
      await mockLoansList(authedPage)
      await authedPage.goto('/loans')

      await expect(authedPage.getByText('HDFC Bank')).toBeVisible()
      const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })

    test(`cheques: no horizontal scroll on ${vp.width}px`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: vp.width, height: vp.height })
      await mockChequesList(authedPage)
      await authedPage.goto('/cheques')

      await expect(authedPage.getByText('CHQ-001234')).toBeVisible()
      const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })

    test(`bank accounts: no horizontal scroll on ${vp.width}px`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: vp.width, height: vp.height })
      await mockBankAccountsList(authedPage)
      await authedPage.goto('/bank-accounts')

      await expect(authedPage.getByText('SBI')).toBeVisible()
      const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })

    test(`other income: no horizontal scroll on ${vp.width}px`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: vp.width, height: vp.height })
      await mockOtherIncomeList(authedPage)
      await authedPage.goto('/other-income')

      await expect(authedPage.getByText('Interest').first()).toBeVisible()
      const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })
  })
}
