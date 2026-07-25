/**
 * Party Management — E2E Tests
 *
 * Covers: list page, create party form, party detail, and responsive checks.
 * All tests use the authedPage fixture from ./fixtures.ts for authenticated state.
 */

import { test, expect, mockApiGet, mockApiEmpty, mockApiPost, MOCK_BUSINESS_ID } from './fixtures'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_PARTIES_RESPONSE = {
  parties: [
    {
      id: 'party_1',
      name: 'Sharma Electronics',
      phone: '9876543210',
      type: 'CUSTOMER',
      tags: [],
      outstandingBalance: 15000000, // 1,50,000 paise
      creditLimit: 50000000,
      isActive: true,
      lastTransactionAt: '2026-03-10T00:00:00Z',
    },
    {
      id: 'party_2',
      name: 'Gupta Traders',
      phone: '9876543211',
      type: 'SUPPLIER',
      tags: [],
      outstandingBalance: -5000000, // -50,000 paise (payable)
      creditLimit: 30000000,
      isActive: true,
      lastTransactionAt: '2026-03-12T00:00:00Z',
    },
  ],
  pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
  summary: {
    totalReceivable: 15000000,
    totalPayable: 5000000,
    netOutstanding: 10000000,
    totalParties: 2,
    customersCount: 1,
    suppliersCount: 1,
    bothCount: 0,
  },
}

const MOCK_EMPTY_PARTIES = {
  parties: [],
  pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
  summary: {
    totalReceivable: 0,
    totalPayable: 0,
    netOutstanding: 0,
    totalParties: 0,
    customersCount: 0,
    suppliersCount: 0,
    bothCount: 0,
  },
}

const MOCK_PARTY_DETAIL = {
  id: 'party_1',
  name: 'Sharma Electronics',
  phone: '9876543210',
  email: 'sharma@example.com',
  companyName: 'Sharma Electronics Pvt Ltd',
  type: 'CUSTOMER',
  tags: [],
  outstandingBalance: 15000000,
  creditLimit: 50000000,
  creditLimitMode: 'WARN',
  totalBusiness: 75000000,
  isActive: true,
  addresses: [],
  customFields: [],
  pricing: [],
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-10T00:00:00Z',
}

const MOCK_EMPTY_TRANSACTIONS = {
  transactions: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  summary: { totalDebit: 0, totalCredit: 0, closingBalance: 0 },
}

const MOCK_CREATED_PARTY = {
  id: 'party_new',
  name: 'New Test Party',
  phone: '9123456789',
  type: 'CUSTOMER',
  tags: [],
  outstandingBalance: 0,
  creditLimit: 0,
  creditLimitMode: 'WARN',
  totalBusiness: 0,
  isActive: true,
  addresses: [],
  customFields: [],
  pricing: [],
  createdAt: '2026-03-17T00:00:00Z',
  updatedAt: '2026-03-17T00:00:00Z',
}

// ─── 1. List Page (/parties) ────────────────────────────────────────────────

test.describe('Parties List Page', () => {
  test('renders party list with mocked data', async ({ authedPage: page }) => {
    await mockApiGet(page, 'parties**', MOCK_PARTIES_RESPONSE)
    await page.goto('/parties')
    await page.waitForLoadState('domcontentloaded')

    // Both party names visible
    await expect(page.getByText('Sharma Electronics')).toBeVisible()
    await expect(page.getByText('Gupta Traders')).toBeVisible()

    // Party list container exists
    const list = page.locator('[role="list"][aria-label="Parties"]')
    await expect(list).toBeVisible()

    // Correct number of list items
    const items = list.locator('[role="listitem"]')
    await expect(items).toHaveCount(2)
  })

  test('shows empty state when no parties exist', async ({ authedPage: page }) => {
    await mockApiGet(page, 'parties**', MOCK_EMPTY_PARTIES)
    await page.goto('/parties')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText('No parties yet')).toBeVisible()
    await expect(page.getByText('Add your first customer or supplier')).toBeVisible()

    // Empty state has an Add Party CTA
    const addBtn = page.getByRole('button', { name: 'Add first party' })
    await expect(addBtn).toBeVisible()
  })

  test('shows loading skeleton initially', async ({ authedPage: page }) => {
    // Delay API response to observe loading state
    await page.route('**/api/parties**', (route) => {
      if (route.request().method() === 'GET') {
        setTimeout(
          () =>
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, data: MOCK_PARTIES_RESPONSE }),
            }),
          2000,
        )
      } else {
        route.continue()
      }
    })

    await page.goto('/parties')
    await page.waitForLoadState('domcontentloaded')

    // Skeleton should be visible while loading
    const skeleton = page.locator('.skeleton, [data-testid="skeleton"], [class*="skeleton"]')
    await expect(skeleton.first()).toBeVisible()
  })

  test('search input is visible and can filter parties', async ({ authedPage: page }) => {
    await mockApiGet(page, 'parties**', MOCK_PARTIES_RESPONSE)
    await page.goto('/parties')
    await page.waitForLoadState('domcontentloaded')

    // Search input exists
    const searchInput = page.getByRole('searchbox', { name: /search parties/i })
    await expect(searchInput).toBeVisible()

    // Type in search — this triggers a debounced API call
    // Mock the filtered response for the search query
    await page.route('**/api/parties**search=Sharma**', (route) => {
      if (route.request().method() === 'GET') {
        const filtered = {
          ...MOCK_PARTIES_RESPONSE,
          parties: MOCK_PARTIES_RESPONSE.parties.filter((p) => p.name.includes('Sharma')),
          pagination: { ...MOCK_PARTIES_RESPONSE.pagination, total: 1 },
        }
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: filtered }),
        })
      } else {
        route.continue()
      }
    })

    await searchInput.fill('Sharma')

    // After debounce, only Sharma should be visible
    await expect(page.getByText('Sharma Electronics')).toBeVisible()
  })

  test('Add Party FAB is visible and navigates to create page', async ({ authedPage: page }) => {
    await mockApiGet(page, 'parties**', MOCK_PARTIES_RESPONSE)
    await page.goto('/parties')
    await page.waitForLoadState('domcontentloaded')

    const fab = page.getByRole('button', { name: /add new party/i })
    await expect(fab).toBeVisible()

    // Mock create page API calls
    await mockApiGet(page, 'party-groups**', [])
    await mockApiGet(page, 'custom-fields**', [])

    await fab.click()
    await expect(page).toHaveURL(/\/parties\/new/)
  })
})

// ─── 2. Create Party (/parties/new) ─────────────────────────────────────────

test.describe('Create Party Page', () => {
  test('form renders with all basic fields visible', async ({ authedPage: page }) => {
    await mockApiGet(page, 'party-groups**', [])
    await mockApiGet(page, 'custom-fields**', [])
    await page.goto('/parties/new')
    await page.waitForLoadState('domcontentloaded')

    // Header
    await expect(page.getByText('New Party')).toBeVisible()

    // Basic Info section is active by default
    await expect(page.getByLabel('Party Name')).toBeVisible()
    await expect(page.getByLabel('Contact Number')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()

    // Party type selector
    await expect(page.getByRole('button', { name: /set party type to customer/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /set party type to supplier/i })).toBeVisible()

    // Save button
    await expect(page.getByRole('button', { name: /save party$/i })).toBeVisible()
  })

  test('shows validation error when submitting with empty name', async ({ authedPage: page }) => {
    await mockApiGet(page, 'party-groups**', [])
    await mockApiGet(page, 'custom-fields**', [])
    await page.goto('/parties/new')
    await page.waitForLoadState('domcontentloaded')

    // Leave name empty and click save
    const saveBtn = page.getByRole('button', { name: /save party$/i })
    await saveBtn.click()

    // Error message should appear for the name field
    // The Input component renders a <p role="alert" class="input-error"> as sibling of input-wrapper
    await expect(page.locator('#party-name-error')).toBeVisible()
  })

  test('can fill and submit the form successfully', async ({ authedPage: page }) => {
    await mockApiGet(page, 'party-groups**', [])
    await mockApiGet(page, 'custom-fields**', [])
    // Register POST mock before GET mock so POST doesn't get consumed by GET's route.continue()
    await mockApiPost(page, 'parties', MOCK_CREATED_PARTY)
    // Mock the parties list for redirect after create — use exact pattern to avoid conflict
    await mockApiGet(page, 'parties?**', MOCK_PARTIES_RESPONSE)

    await page.goto('/parties/new')
    await page.waitForLoadState('domcontentloaded')

    // Fill basic fields
    await page.getByLabel('Party Name').fill('New Test Party')
    await page.getByLabel('Contact Number').fill('9123456789')

    // Select Customer type (should be default, but click to be sure)
    await page.getByRole('button', { name: /set party type to customer/i }).click()

    // Submit
    const saveBtn = page.getByRole('button', { name: /save party$/i })
    await saveBtn.click()

    // Should navigate away from /parties/new after successful creation
    await expect(page).not.toHaveURL(/\/parties\/new/)
  })
})

// ─── 3. Party Detail (/parties/:id) ────────────────────────────────────────

test.describe('Party Detail Page', () => {
  test('shows party name, phone, and balance', async ({ authedPage: page }) => {
    await mockApiGet(page, 'parties/party_1', MOCK_PARTY_DETAIL)
    await mockApiGet(page, 'parties/party_1/transactions**', MOCK_EMPTY_TRANSACTIONS)
    await page.goto('/parties/party_1')
    await page.waitForLoadState('domcontentloaded')

    // Party name (use heading to avoid matching the aria-live status announcement)
    await expect(page.getByRole('heading', { name: 'Sharma Electronics' })).toBeVisible()

    // Balance region exists with outstanding info
    const balanceRegion = page.locator('[aria-label="Party overview"]')
    await expect(balanceRegion).toBeVisible()

    // Phone number (formatted or raw) — scoped to party overview to avoid matching user profile
    await expect(balanceRegion.getByText(/987/)).toBeVisible()

    // Type badge
    await expect(page.getByText(/customer/i).first()).toBeVisible()
  })

  test('shows empty transaction history', async ({ authedPage: page }) => {
    await mockApiGet(page, 'parties/party_1', MOCK_PARTY_DETAIL)
    await mockApiGet(page, 'parties/party_1/transactions**', MOCK_EMPTY_TRANSACTIONS)
    await page.goto('/parties/party_1')
    await page.waitForLoadState('domcontentloaded')

    // Click the Transactions tab
    const txnTab = page.getByRole('tab', { name: 'Transactions' })
    await expect(txnTab).toBeVisible()
    await txnTab.click()

    // Empty state for transactions
    await expect(page.getByText('No transactions yet')).toBeVisible()
    await expect(page.getByText(/create an invoice or record a payment/i)).toBeVisible()
  })

  test('back button navigates to parties list', async ({ authedPage: page }) => {
    await mockApiGet(page, 'parties/party_1', MOCK_PARTY_DETAIL)
    await mockApiGet(page, 'parties/party_1/transactions**', MOCK_EMPTY_TRANSACTIONS)
    // Mock list page for navigation
    await mockApiGet(page, 'parties?**', MOCK_PARTIES_RESPONSE)
    await mockApiGet(page, 'parties', MOCK_PARTIES_RESPONSE)

    await page.goto('/parties/party_1')
    await page.waitForLoadState('domcontentloaded')

    // Header has a back button (aria-label="Go back")
    const backBtn = page.getByRole('button', { name: 'Go back' })
    await expect(backBtn).toBeVisible()
    await backBtn.click()

    await expect(page).toHaveURL(/\/parties$/)
  })
})

// ─── 4. Responsive Checks ──────────────────────────────────────────────────

test.describe('Parties — Responsive', () => {
  test('no horizontal scroll on 375px for list page', async ({ authedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockApiGet(page, 'parties**', MOCK_PARTIES_RESPONSE)
    await page.goto('/parties')
    await page.waitForLoadState('domcontentloaded')

    // Wait for list to render
    await expect(page.getByText('Sharma Electronics')).toBeVisible()

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  test('no horizontal scroll on 320px for list page', async ({ authedPage: page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await mockApiGet(page, 'parties**', MOCK_PARTIES_RESPONSE)
    await page.goto('/parties')
    await page.waitForLoadState('domcontentloaded')

    // Wait for list to render
    await expect(page.getByText('Sharma Electronics')).toBeVisible()

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
})
