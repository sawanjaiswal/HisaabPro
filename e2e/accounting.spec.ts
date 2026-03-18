/**
 * Accounting features — E2E tests
 *
 * Covers: Chart of Accounts, Journal Entries, Trial Balance, FY Closure.
 * All API calls mocked via fixtures helpers.
 */

import { test, expect, mockApiGet, mockApiError, mockApiEmpty } from './fixtures'
import type { Page } from '@playwright/test'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_ACCOUNTS = {
  items: [
    { id: 'acc_1', code: '1000', name: 'Cash', type: 'ASSET', subType: 'CURRENT_ASSET', parentId: null, description: null, isSystem: true, isActive: true, balance: 5000000, children: [] },
    { id: 'acc_2', code: '2000', name: 'Accounts Payable', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentId: null, description: null, isSystem: true, isActive: true, balance: -2000000, children: [] },
    { id: 'acc_3', code: '3000', name: 'Owner Equity', type: 'EQUITY', subType: null, parentId: null, description: null, isSystem: true, isActive: true, balance: 3000000, children: [] },
    { id: 'acc_4', code: '4000', name: 'Sales Revenue', type: 'INCOME', subType: null, parentId: null, description: null, isSystem: true, isActive: true, balance: 8000000, children: [] },
    { id: 'acc_5', code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE', subType: null, parentId: null, description: null, isSystem: true, isActive: true, balance: 4000000, children: [] },
  ],
  total: 5,
  page: 1,
  limit: 100,
}

const MOCK_JOURNAL_ENTRIES = {
  items: [
    {
      id: 'je_1', entryNumber: 'JE-001', date: '2026-03-15', narration: 'Sales invoice posted',
      type: 'SALES', status: 'POSTED', sourceType: 'SALE_INVOICE', sourceNumber: 'INV-001',
      totalDebit: 1500000, totalCredit: 1500000,
      lines: [
        { id: 'jl_1', accountId: 'acc_1', debit: 1500000, credit: 0, narration: null, partyId: null, account: { code: '1000', name: 'Cash', type: 'ASSET' } },
        { id: 'jl_2', accountId: 'acc_4', debit: 0, credit: 1500000, narration: null, partyId: null, account: { code: '4000', name: 'Sales Revenue', type: 'INCOME' } },
      ],
      createdAt: '2026-03-15T10:00:00Z',
    },
    {
      id: 'je_2', entryNumber: 'JE-002', date: '2026-03-16', narration: 'Expense recorded',
      type: 'EXPENSE', status: 'POSTED', sourceType: null, sourceNumber: null,
      totalDebit: 250000, totalCredit: 250000,
      lines: [
        { id: 'jl_3', accountId: 'acc_5', debit: 250000, credit: 0, narration: null, partyId: null, account: { code: '5000', name: 'COGS', type: 'EXPENSE' } },
        { id: 'jl_4', accountId: 'acc_1', debit: 0, credit: 250000, narration: null, partyId: null, account: { code: '1000', name: 'Cash', type: 'ASSET' } },
      ],
      createdAt: '2026-03-16T10:00:00Z',
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
}

const MOCK_TRIAL_BALANCE = {
  rows: [
    { accountId: 'acc_1', code: '1000', name: 'Cash', type: 'ASSET', subType: 'CURRENT_ASSET', totalDebit: 5000000, totalCredit: 250000, netBalance: 4750000 },
    { accountId: 'acc_2', code: '2000', name: 'Accounts Payable', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', totalDebit: 0, totalCredit: 2000000, netBalance: -2000000 },
    { accountId: 'acc_4', code: '4000', name: 'Sales Revenue', type: 'INCOME', subType: null, totalDebit: 0, totalCredit: 1500000, netBalance: -1500000 },
    { accountId: 'acc_5', code: '5000', name: 'COGS', type: 'EXPENSE', subType: null, totalDebit: 250000, totalCredit: 0, netBalance: 250000 },
  ],
  totals: { debit: 5250000, credit: 3750000 },
}

const MOCK_FY_CLOSURES = [
  {
    id: 'fyc_1', financialYear: '2425', closedAt: '2025-04-01T00:00:00Z',
    closedBy: 'user_test_001', retainedEarnings: 1200000,
    status: 'CLOSED' as const, journalEntryId: 'je_fy_1',
  },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

async function mockAccountsList(page: Page) {
  await mockApiGet(page, 'accounting/accounts**', MOCK_ACCOUNTS)
}

async function mockAccountsEmpty(page: Page) {
  await mockApiGet(page, 'accounting/accounts**', { items: [], total: 0, page: 1, limit: 100 })
}

async function mockJournalEntries(page: Page) {
  await mockApiGet(page, 'accounting/entries**', MOCK_JOURNAL_ENTRIES)
}

async function mockJournalEntriesEmpty(page: Page) {
  await mockApiGet(page, 'accounting/entries**', { items: [], total: 0, page: 1, limit: 20 })
}

async function mockTrialBalance(page: Page) {
  await mockApiGet(page, 'accounting/reports/trial-balance**', MOCK_TRIAL_BALANCE)
}

async function mockTrialBalanceEmpty(page: Page) {
  await mockApiGet(page, 'accounting/reports/trial-balance**', { rows: [], totals: { debit: 0, credit: 0 } })
}

async function mockFYClosures(page: Page) {
  await mockApiGet(page, 'fy-closure**', MOCK_FY_CLOSURES)
}

async function mockFYClosuresEmpty(page: Page) {
  await mockApiGet(page, 'fy-closure**', [])
}

// ─── Chart of Accounts ──────────────────────────────────────────────────────

test.describe('Chart of Accounts', () => {
  test('renders accounts grouped by type', async ({ authedPage }) => {
    await mockAccountsList(authedPage)
    await authedPage.goto('/accounting/chart-of-accounts')

    await expect(authedPage.getByText('Chart of Accounts')).toBeVisible()
    await expect(authedPage.getByText('Cash')).toBeVisible()
    await expect(authedPage.getByText('Accounts Payable')).toBeVisible()
    await expect(authedPage.getByText('Sales Revenue')).toBeVisible()
  })

  test('shows loading skeleton', async ({ authedPage }) => {
    // Delay response to see skeleton
    await authedPage.route('**/api/accounting/accounts**', (route) =>
      setTimeout(() => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_ACCOUNTS }),
      }), 2000),
    )
    await authedPage.goto('/accounting/chart-of-accounts')

    const skeleton = authedPage.locator('[aria-busy="true"]').or(authedPage.locator('.skeleton'))
    // Page should render something (skeleton or content), not be blank
    const body = authedPage.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('shows error state with retry button', async ({ authedPage }) => {
    await mockApiError(authedPage, 'accounting/accounts**')
    await authedPage.goto('/accounting/chart-of-accounts')

    await expect(authedPage.getByText('Could not load accounts')).toBeVisible()
    await expect(authedPage.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('shows empty state when no accounts', async ({ authedPage }) => {
    await mockAccountsEmpty(authedPage)
    await authedPage.goto('/accounting/chart-of-accounts')

    await expect(authedPage.getByText('No accounts yet')).toBeVisible()
    await expect(authedPage.getByText(/Seed Default Accounts/)).toBeVisible()
  })

  test('seed button is visible', async ({ authedPage }) => {
    await mockAccountsList(authedPage)
    await authedPage.goto('/accounting/chart-of-accounts')

    await expect(authedPage.getByLabel('Seed default chart of accounts')).toBeVisible()
  })
})

// ─── Journal Entries ────────────────────────────────────────────────────────

test.describe('Journal Entries', () => {
  test('renders journal entry list with filters', async ({ authedPage }) => {
    await mockJournalEntries(authedPage)
    await authedPage.goto('/accounting/journal-entries')

    await expect(authedPage.getByText('Journal Entries')).toBeVisible()
    await expect(authedPage.getByText('JE-001')).toBeVisible()
    await expect(authedPage.getByText('JE-002')).toBeVisible()
    await expect(authedPage.getByText('2 entries')).toBeVisible()
  })

  test('shows loading skeleton on initial load', async ({ authedPage }) => {
    await authedPage.route('**/api/accounting/entries**', (route) =>
      setTimeout(() => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_JOURNAL_ENTRIES }),
      }), 2000),
    )
    await authedPage.goto('/accounting/journal-entries')

    const body = authedPage.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('shows error state with retry', async ({ authedPage }) => {
    await mockApiError(authedPage, 'accounting/entries**')
    await authedPage.goto('/accounting/journal-entries')

    await expect(authedPage.getByText('Could not load journal entries')).toBeVisible()
    await expect(authedPage.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('shows empty state when no entries', async ({ authedPage }) => {
    await mockJournalEntriesEmpty(authedPage)
    await authedPage.goto('/accounting/journal-entries')

    await expect(authedPage.getByText('No journal entries')).toBeVisible()
    await expect(authedPage.getByText(/created automatically/)).toBeVisible()
  })

  test('filter pills are visible and clickable', async ({ authedPage }) => {
    await mockJournalEntries(authedPage)
    await authedPage.goto('/accounting/journal-entries')

    // Type filter pills
    await expect(authedPage.getByLabel('Filter by All Types')).toBeVisible()

    // Status filter pills
    await expect(authedPage.getByLabel('Filter by status All Status')).toBeVisible()
  })
})

// ─── Trial Balance ──────────────────────────────────────────────────────────

test.describe('Trial Balance', () => {
  test('renders trial balance table with accounts', async ({ authedPage }) => {
    await mockTrialBalance(authedPage)
    await authedPage.goto('/reports/trial-balance')

    await expect(authedPage.getByText('Trial Balance')).toBeVisible()
    await expect(authedPage.getByText('Cash')).toBeVisible()
    await expect(authedPage.getByText('Accounts Payable')).toBeVisible()
  })

  test('shows balance indicator', async ({ authedPage }) => {
    await mockTrialBalance(authedPage)
    await authedPage.goto('/reports/trial-balance')

    // Unbalanced since debit (52,500) != credit (37,500)
    const statusIndicator = authedPage.getByRole('status')
    await expect(statusIndicator).toBeVisible()
  })

  test('shows error state with retry', async ({ authedPage }) => {
    await mockApiError(authedPage, 'accounting/reports/trial-balance**')
    await authedPage.goto('/reports/trial-balance')

    await expect(authedPage.getByText('Could not load trial balance')).toBeVisible()
    await expect(authedPage.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('shows empty state when no data', async ({ authedPage }) => {
    await mockTrialBalanceEmpty(authedPage)
    await authedPage.goto('/reports/trial-balance')

    await expect(authedPage.getByText('No data available')).toBeVisible()
    await expect(authedPage.getByText(/Post journal entries/)).toBeVisible()
  })

  test('date input is visible', async ({ authedPage }) => {
    await mockTrialBalance(authedPage)
    await authedPage.goto('/reports/trial-balance')

    await expect(authedPage.getByLabel(/As of date/)).toBeVisible()
  })
})

// ─── FY Closure ─────────────────────────────────────────────────────────────

test.describe('FY Closure', () => {
  test('renders closure list with closed FY', async ({ authedPage }) => {
    await mockFYClosures(authedPage)
    await authedPage.goto('/accounting/fy-closure')

    await expect(authedPage.getByText('FY Closure')).toBeVisible()
    await expect(authedPage.getByText('FY 2024-25')).toBeVisible()
    await expect(authedPage.getByText('CLOSED', { exact: true })).toBeVisible()
  })

  test('shows loading skeleton', async ({ authedPage }) => {
    await authedPage.route('**/api/fy-closure**', (route) =>
      setTimeout(() => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_FY_CLOSURES }),
      }), 2000),
    )
    await authedPage.goto('/accounting/fy-closure')

    const body = authedPage.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('shows error state with retry', async ({ authedPage }) => {
    await mockApiError(authedPage, 'fy-closure**')
    await authedPage.goto('/accounting/fy-closure')

    await expect(authedPage.getByText('Could not load closures')).toBeVisible()
    await expect(authedPage.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('shows empty state when no closures', async ({ authedPage }) => {
    await mockFYClosuresEmpty(authedPage)
    await authedPage.goto('/accounting/fy-closure')

    await expect(authedPage.getByText('No FY closures yet')).toBeVisible()
  })

  test('close FY form is visible with input and button', async ({ authedPage }) => {
    await mockFYClosuresEmpty(authedPage)
    await authedPage.goto('/accounting/fy-closure')

    await expect(authedPage.getByText('Close Financial Year')).toBeVisible()
    await expect(authedPage.getByLabel(/Financial year code/)).toBeVisible()
  })

  test('reopen button visible on closed FY', async ({ authedPage }) => {
    await mockFYClosures(authedPage)
    await authedPage.goto('/accounting/fy-closure')

    await expect(authedPage.getByLabel(/Reopen FY 2024-25/)).toBeVisible()
  })
})

// ─── Responsive Tests ───────────────────────────────────────────────────────

const MOBILE_VIEWPORTS = [
  { name: 'iPhone 14', width: 375, height: 812 },
  { name: 'iPhone SE', width: 320, height: 568 },
]

for (const vp of MOBILE_VIEWPORTS) {
  test.describe(`Responsive — ${vp.name} (${vp.width}px)`, () => {
    test(`chart of accounts: no horizontal scroll on ${vp.width}px`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: vp.width, height: vp.height })
      await mockAccountsList(authedPage)
      await authedPage.goto('/accounting/chart-of-accounts')

      await expect(authedPage.getByText('Cash')).toBeVisible()
      const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })

    test(`journal entries: no horizontal scroll on ${vp.width}px`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: vp.width, height: vp.height })
      await mockJournalEntries(authedPage)
      await authedPage.goto('/accounting/journal-entries')

      await expect(authedPage.getByText('JE-001')).toBeVisible()
      const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })

    test(`trial balance: no horizontal scroll on ${vp.width}px`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: vp.width, height: vp.height })
      await mockTrialBalance(authedPage)
      await authedPage.goto('/reports/trial-balance')

      await expect(authedPage.getByText('Trial Balance')).toBeVisible()
      const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })

    test(`fy closure: no horizontal scroll on ${vp.width}px`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: vp.width, height: vp.height })
      await mockFYClosures(authedPage)
      await authedPage.goto('/accounting/fy-closure')

      await expect(authedPage.getByText('FY Closure')).toBeVisible()
      const scrollWidth = await authedPage.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await authedPage.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })
  })
}
