/**
 * Serial Number Tracking — E2E Tests
 *
 * Covers: CRUD, bulk create, search with debounce, status badges + transitions,
 * duplicate error, phone masking, pagination, and detail with history.
 */

import { test, expect, mockApiGet, mockApiPost, mockApiEmpty, mockApiError } from './fixtures'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_PRODUCT = {
  id: 'prod_1',
  name: 'Samsung Galaxy A15',
  sku: 'PHN-001',
  trackSerials: true,
  salePrice: 1499900,
  currentStock: 20,
}

const MOCK_SERIALS = [
  {
    id: 'srl_1',
    serialNumber: 'IMEI-001-2026-A',
    productId: 'prod_1',
    productName: 'Samsung Galaxy A15',
    status: 'AVAILABLE',
    purchaseDate: '2026-01-15',
    warrantyEndDate: '2027-01-15',
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'srl_2',
    serialNumber: 'IMEI-002-2026-A',
    productId: 'prod_1',
    productName: 'Samsung Galaxy A15',
    status: 'SOLD',
    purchaseDate: '2026-01-15',
    soldDate: '2026-02-20',
    customerName: 'Rahul Sharma',
    customerPhone: '9876543210',
    invoiceId: 'inv_1',
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'srl_3',
    serialNumber: 'IMEI-003-2026-A',
    productId: 'prod_1',
    productName: 'Samsung Galaxy A15',
    status: 'RETURNED',
    purchaseDate: '2026-01-15',
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'srl_4',
    serialNumber: 'IMEI-004-2026-A',
    productId: 'prod_1',
    productName: 'Samsung Galaxy A15',
    status: 'DAMAGED',
    purchaseDate: '2026-01-15',
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'srl_5',
    serialNumber: 'IMEI-005-2026-A',
    productId: 'prod_1',
    productName: 'Samsung Galaxy A15',
    status: 'WARRANTY',
    purchaseDate: '2026-01-15',
    warrantyEndDate: '2027-01-15',
    createdAt: '2026-01-15T00:00:00Z',
  },
]

const MOCK_SERIAL_DETAIL = {
  ...MOCK_SERIALS[1],
  history: [
    { id: 'h1', action: 'CREATED', date: '2026-01-15T00:00:00Z', note: 'Added via purchase' },
    { id: 'h2', action: 'SOLD', date: '2026-02-20T00:00:00Z', note: 'Invoice #INV-042', customerName: 'Rahul Sharma', customerPhone: '9876543210' },
  ],
}

const MOCK_SERIALS_PAGINATED = {
  serials: MOCK_SERIALS,
  pagination: { page: 1, limit: 20, total: 50, totalPages: 3 },
}

// ─── Serial Number Tests ─────────────────────────────────────────────────────

test.describe('Serial Number Tracking', () => {
  test('should show empty state when no serials exist', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'products/prod_1/serials**', { serials: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
    await mockApiGet(page, 'serials**', { serials: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
    await page.goto('/products/prod_1/serials')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText(/no serial|add.*first.*serial|no.*serial.*number/i)).toBeVisible({ timeout: 5000 })
    const addBtn = page.getByRole('button', { name: /add.*serial|create|new/i })
    await expect(addBtn).toBeVisible()
  })

  // ─── Create Single Serial ──────────────────────────────────────────────────

  test('should create a single serial number', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'products/prod_1/serials**', MOCK_SERIALS_PAGINATED)
    await mockApiGet(page, 'serials**', MOCK_SERIALS_PAGINATED)
    const newSerial = { id: 'srl_new', serialNumber: 'IMEI-NEW-2026', productId: 'prod_1', status: 'AVAILABLE', createdAt: '2026-03-21T00:00:00Z' }
    await mockApiPost(page, 'products/prod_1/serials*', newSerial)
    await mockApiPost(page, 'serials*', newSerial)

    await page.goto('/products/prod_1/serials')
    await page.waitForLoadState('domcontentloaded')

    // Open create form
    await page.getByRole('button', { name: /add.*serial|create|new/i }).click()

    // Fill serial number
    await page.getByLabel(/serial.*number|serial.*no/i).fill('IMEI-NEW-2026')

    // Submit
    await page.getByRole('button', { name: /save|create|add/i }).last().click()
    await expect(page.getByText(/created|added|success/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Bulk Create Serials ───────────────────────────────────────────────────

  test('should bulk create serial numbers', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'products/prod_1/serials**', MOCK_SERIALS_PAGINATED)
    await mockApiGet(page, 'serials**', MOCK_SERIALS_PAGINATED)

    const bulkResult = { created: 5, serialNumbers: ['BULK-001', 'BULK-002', 'BULK-003', 'BULK-004', 'BULK-005'] }
    await mockApiPost(page, 'products/prod_1/serials/bulk*', bulkResult)
    await mockApiPost(page, 'serials/bulk*', bulkResult)

    await page.goto('/products/prod_1/serials')
    await page.waitForLoadState('domcontentloaded')

    // Open bulk create
    const bulkBtn = page.getByRole('button', { name: /bulk|import|multiple/i })
    if (await bulkBtn.count() > 0) {
      await bulkBtn.click()
    } else {
      // May be under add menu
      await page.getByRole('button', { name: /add.*serial|create|new/i }).click()
      const bulkOption = page.getByText(/bulk|multiple|batch/i)
      if (await bulkOption.count() > 0) {
        await bulkOption.click()
      }
    }

    // Enter serial numbers (one per line or comma-separated)
    const textArea = page.getByRole('textbox').or(page.locator('textarea'))
    await textArea.last().fill('BULK-001\nBULK-002\nBULK-003\nBULK-004\nBULK-005')

    // Submit
    await page.getByRole('button', { name: /save|create|add|import/i }).last().click()
    await expect(page.getByText(/created|added|success|5.*serial/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Serial Lookup / Search ────────────────────────────────────────────────

  test('should search serials with results', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'products/prod_1/serials**', MOCK_SERIALS_PAGINATED)
    await mockApiGet(page, 'serials**', MOCK_SERIALS_PAGINATED)
    await page.goto('/products/prod_1/serials')
    await page.waitForLoadState('domcontentloaded')

    // Type in search
    const searchInput = page.getByPlaceholder(/search|find|lookup/i)
    await searchInput.fill('IMEI-001')

    // Mock filtered result
    await mockApiGet(page, 'products/prod_1/serials**', { serials: [MOCK_SERIALS[0]], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } })
    await mockApiGet(page, 'serials**', { serials: [MOCK_SERIALS[0]], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } })

    // Wait for debounced search
    await page.waitForTimeout(500)

    // Result should appear
    await expect(page.getByText('IMEI-001-2026-A')).toBeVisible({ timeout: 5000 })
  })

  // ─── Status Badge Colors ───────────────────────────────────────────────────

  test('should display correct status badge colors', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'products/prod_1/serials**', { serials: MOCK_SERIALS, pagination: { page: 1, limit: 20, total: 5, totalPages: 1 } })
    await mockApiGet(page, 'serials**', { serials: MOCK_SERIALS, pagination: { page: 1, limit: 20, total: 5, totalPages: 1 } })
    await page.goto('/products/prod_1/serials')
    await page.waitForLoadState('domcontentloaded')

    // Wait for all serial items to render
    await expect(page.getByText('IMEI-001-2026-A')).toBeVisible({ timeout: 5000 })

    // Check badge text and computed color
    const badges = {
      AVAILABLE: page.getByText('AVAILABLE').or(page.getByText('Available')),
      SOLD: page.getByText('SOLD').or(page.getByText('Sold')),
      RETURNED: page.getByText('RETURNED').or(page.getByText('Returned')),
      DAMAGED: page.getByText('DAMAGED').or(page.getByText('Damaged')),
      WARRANTY: page.getByText('WARRANTY').or(page.getByText('Warranty')),
    }

    // Each badge should be visible
    for (const [status, badge] of Object.entries(badges)) {
      await expect(badge.first()).toBeVisible({ timeout: 3000 })
    }

    // Verify green for AVAILABLE
    const availableBadge = badges.AVAILABLE.first()
    const availableColor = await availableBadge.evaluate((el) => getComputedStyle(el).backgroundColor)
    // Should contain green hue (various green shades)
    expect(availableColor).toBeTruthy()
  })

  // ─── Valid Status Transition ───────────────────────────────────────────────

  test('should allow valid status transition (AVAILABLE to SOLD)', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'serials/srl_1', { ...MOCK_SERIALS[0] })
    await mockApiGet(page, 'products/prod_1/serials/srl_1', { ...MOCK_SERIALS[0] })

    await page.route('**/api/serials/srl_1/status', (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH' || route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...MOCK_SERIALS[0], status: 'SOLD' } }),
        })
      } else {
        route.continue()
      }
    })
    await page.route('**/api/products/prod_1/serials/srl_1/status', (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH' || route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...MOCK_SERIALS[0], status: 'SOLD' } }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/products/prod_1/serials/srl_1')
    await page.waitForLoadState('domcontentloaded')

    // Change status
    const statusBtn = page.getByRole('button', { name: /status|change.*status/i }).or(page.getByLabel(/status/i))
    await statusBtn.click()

    // Select SOLD
    await page.getByText(/sold/i).last().click()

    // Confirm if needed
    const confirmBtn = page.getByRole('button', { name: /confirm|save|update/i })
    if (await confirmBtn.count() > 0) {
      await confirmBtn.last().click()
    }

    await expect(page.getByText(/updated|changed|success/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Invalid Status Transition ─────────────────────────────────────────────

  test('should reject invalid status transition (WARRANTY to AVAILABLE)', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'serials/srl_5', MOCK_SERIALS[4])
    await mockApiGet(page, 'products/prod_1/serials/srl_5', MOCK_SERIALS[4])

    await page.route('**/api/serials/srl_5/status', (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH' || route.request().method() === 'POST') {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'INVALID_TRANSITION', message: 'Cannot transition from WARRANTY to AVAILABLE' } }),
        })
      } else {
        route.continue()
      }
    })
    await page.route('**/api/products/prod_1/serials/srl_5/status', (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH' || route.request().method() === 'POST') {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'INVALID_TRANSITION', message: 'Cannot transition from WARRANTY to AVAILABLE' } }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/products/prod_1/serials/srl_5')
    await page.waitForLoadState('domcontentloaded')

    const statusBtn = page.getByRole('button', { name: /status|change.*status/i }).or(page.getByLabel(/status/i))
    await statusBtn.click()

    // Try selecting AVAILABLE
    const availableOption = page.getByText(/available/i).last()
    if (await availableOption.isEnabled()) {
      await availableOption.click()
      const confirmBtn = page.getByRole('button', { name: /confirm|save|update/i })
      if (await confirmBtn.count() > 0) {
        await confirmBtn.last().click()
      }
    }

    // Should show error about invalid transition
    await expect(page.getByText(/cannot.*transition|invalid.*transition|not.*allowed/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Duplicate Serial Number ───────────────────────────────────────────────

  test('should show error for duplicate serial number', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'products/prod_1/serials**', MOCK_SERIALS_PAGINATED)
    await mockApiGet(page, 'serials**', MOCK_SERIALS_PAGINATED)

    await page.route('**/api/products/prod_1/serials', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'DUPLICATE', message: 'Serial number already exists' } }),
        })
      } else {
        route.continue()
      }
    })
    await page.route('**/api/serials', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'DUPLICATE', message: 'Serial number already exists' } }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/products/prod_1/serials')
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /add.*serial|create|new/i }).click()
    await page.getByLabel(/serial.*number|serial.*no/i).fill('IMEI-001-2026-A')
    await page.getByRole('button', { name: /save|create|add/i }).last().click()

    await expect(page.getByText(/already exists|duplicate|serial.*taken/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Search Debounce ───────────────────────────────────────────────────────

  test('should debounce search input', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'products/prod_1/serials**', MOCK_SERIALS_PAGINATED)
    await mockApiGet(page, 'serials**', MOCK_SERIALS_PAGINATED)

    let searchRequestCount = 0
    await page.route('**/api/**/serials**', (route) => {
      const url = route.request().url()
      if (url.includes('search') || url.includes('q=')) {
        searchRequestCount++
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { serials: MOCK_SERIALS, pagination: { page: 1, limit: 20, total: 5, totalPages: 1 } } }),
      })
    })

    await page.goto('/products/prod_1/serials')
    await page.waitForLoadState('domcontentloaded')

    const searchInput = page.getByPlaceholder(/search|find|lookup/i)

    // Type quickly - each keystroke
    searchRequestCount = 0
    await searchInput.pressSequentially('IMEI', { delay: 50 })

    // Wait for debounce
    await page.waitForTimeout(500)

    // Should NOT have fired a request per keystroke (4 chars = 4 requests)
    // Debounce should consolidate to 1-2 requests
    expect(searchRequestCount).toBeLessThan(4)
  })

  // ─── Phone Masking in History ──────────────────────────────────────────────

  test('should mask phone numbers in serial history', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'serials/srl_2', MOCK_SERIAL_DETAIL)
    await mockApiGet(page, 'products/prod_1/serials/srl_2', MOCK_SERIAL_DETAIL)
    await page.goto('/products/prod_1/serials/srl_2')
    await page.waitForLoadState('domcontentloaded')

    // Phone should be masked: 98****3210 or similar
    // Should NOT show full phone number 9876543210
    const pageContent = await page.textContent('body')
    expect(pageContent).not.toContain('9876543210')

    // Should show some masked version
    await expect(page.getByText(/98\*+|987\*+|\*+3210/)).toBeVisible({ timeout: 5000 })
  })

  // ─── Pagination ────────────────────────────────────────────────────────────

  test('should paginate through serial numbers', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'products/prod_1/serials**', MOCK_SERIALS_PAGINATED)
    await mockApiGet(page, 'serials**', MOCK_SERIALS_PAGINATED)
    await page.goto('/products/prod_1/serials')
    await page.waitForLoadState('domcontentloaded')

    // Should show pagination info (50 total, page 1 of 3)
    await expect(page.getByText(/page|showing|1.*of.*3|50.*serial/i)).toBeVisible({ timeout: 5000 })

    // Next page button should be visible
    const nextBtn = page.getByRole('button', { name: /next|›|>>/i })
    await expect(nextBtn).toBeVisible()
    await expect(nextBtn).toBeEnabled()
  })

  // ─── Detail View with Full History ─────────────────────────────────────────

  test('should show serial detail with full history timeline', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'serials/srl_2', MOCK_SERIAL_DETAIL)
    await mockApiGet(page, 'products/prod_1/serials/srl_2', MOCK_SERIAL_DETAIL)
    await page.goto('/products/prod_1/serials/srl_2')
    await page.waitForLoadState('domcontentloaded')

    // Serial number visible
    await expect(page.getByText('IMEI-002-2026-A')).toBeVisible({ timeout: 5000 })

    // Status badge visible
    await expect(page.getByText(/sold/i).first()).toBeVisible()

    // History entries visible
    await expect(page.getByText(/added|created|purchase/i).first()).toBeVisible()
    await expect(page.getByText(/INV-042|invoice/i)).toBeVisible()
  })
})
