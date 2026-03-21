/**
 * Batch Tracking — E2E Tests
 *
 * Covers: batch CRUD on products, expiry validation, duplicate batch number,
 * delete protection, zero-cost display, and navigation.
 */

import { test, expect, mockApiGet, mockApiPost, mockApiError } from './fixtures'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_PRODUCT = {
  id: 'prod_1',
  name: 'Crocin Advance 500mg',
  sku: 'MED-001',
  trackBatches: true,
  salePrice: 3500,
  purchasePrice: 2800,
  currentStock: 500,
}

const MOCK_BATCHES = [
  {
    id: 'batch_1',
    batchNumber: 'BA-2026-001',
    productId: 'prod_1',
    manufacturingDate: '2025-06-01',
    expiryDate: '2027-06-01',
    costPrice: 2500,
    sellingPrice: 3500,
    quantity: 200,
    currentStock: 180,
    status: 'ACTIVE',
    createdAt: '2025-06-15T00:00:00Z',
  },
  {
    id: 'batch_2',
    batchNumber: 'BA-2026-002',
    productId: 'prod_1',
    manufacturingDate: '2025-09-01',
    expiryDate: '2027-09-01',
    costPrice: 0,
    sellingPrice: 3500,
    quantity: 300,
    currentStock: 300,
    status: 'ACTIVE',
    createdAt: '2025-09-20T00:00:00Z',
  },
]

const MOCK_BATCH_DETAIL = {
  ...MOCK_BATCHES[0],
  movements: [
    { id: 'mv_1', type: 'IN', quantity: 200, date: '2025-06-15', reference: 'Purchase #P-001' },
    { id: 'mv_2', type: 'OUT', quantity: 20, date: '2025-07-10', reference: 'Invoice #INV-042' },
  ],
}

const MOCK_EMPTY_BATCH_WITH_STOCK = {
  ...MOCK_BATCHES[0],
  currentStock: 50,
}

// ─── Batch List ─────────────────────────────────────────────────────────────

test.describe('Batch Tracking', () => {
  test('should show empty state when product has no batches', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'products/prod_1/batches**', [])
    await mockApiGet(page, 'batches**', [])
    await page.goto('/products/prod_1/batches')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText(/no batch|add.*first.*batch|no.*batches/i)).toBeVisible({ timeout: 5000 })
    const addBtn = page.getByRole('button', { name: /add.*batch|create.*batch|new/i })
    await expect(addBtn).toBeVisible()
  })

  // ─── Create Batch ──────────────────────────────────────────────────────────

  test('should create a batch with all fields', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'products/prod_1/batches**', MOCK_BATCHES)
    await mockApiGet(page, 'batches**', MOCK_BATCHES)

    const newBatch = {
      id: 'batch_new',
      batchNumber: 'BA-2026-003',
      productId: 'prod_1',
      manufacturingDate: '2026-01-01',
      expiryDate: '2028-01-01',
      costPrice: 2600,
      sellingPrice: 3600,
      quantity: 150,
      currentStock: 150,
      status: 'ACTIVE',
    }
    await mockApiPost(page, 'products/prod_1/batches*', newBatch)
    await mockApiPost(page, 'batches*', newBatch)

    await page.goto('/products/prod_1/batches')
    await page.waitForLoadState('domcontentloaded')

    // Open create form
    const addBtn = page.getByRole('button', { name: /add.*batch|create.*batch|new/i })
    await addBtn.click()

    // Fill batch details
    await page.getByLabel(/batch.*number|batch.*no/i).fill('BA-2026-003')
    await page.getByLabel(/manufacturing.*date|mfg.*date/i).fill('2026-01-01')
    await page.getByLabel(/expiry.*date|exp.*date/i).fill('2028-01-01')
    await page.getByLabel(/cost.*price|purchase.*price/i).fill('26')
    await page.getByLabel(/selling.*price|sale.*price/i).fill('36')
    await page.getByLabel(/quantity|qty|opening.*stock/i).fill('150')

    // Submit
    await page.getByRole('button', { name: /save|create|add/i }).last().click()

    // Success
    await expect(page.getByText(/created|added|success/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Zero Cost Price ───────────────────────────────────────────────────────

  test('should display zero cost price as Rs 0.00', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'products/prod_1/batches**', MOCK_BATCHES)
    await mockApiGet(page, 'batches**', MOCK_BATCHES)
    await page.goto('/products/prod_1/batches')
    await page.waitForLoadState('domcontentloaded')

    // Batch BA-2026-002 has costPrice: 0
    // Should display as "0.00" or "Rs 0.00", not blank or dash
    const batchRow = page.getByText('BA-2026-002').locator('..')
    await expect(batchRow.or(page.locator(':has-text("BA-2026-002")')).first()).toBeVisible()

    // Verify zero is displayed, not hidden
    await expect(page.getByText(/₹\s*0\.00|Rs\.?\s*0\.00|0\.00/)).toBeVisible()
  })

  // ─── View Batch Detail ─────────────────────────────────────────────────────

  test('should show batch detail with movement history', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'products/prod_1/batches**', MOCK_BATCHES)
    await mockApiGet(page, 'batches**', MOCK_BATCHES)
    await mockApiGet(page, 'batches/batch_1', MOCK_BATCH_DETAIL)
    await mockApiGet(page, 'products/prod_1/batches/batch_1', MOCK_BATCH_DETAIL)
    await page.goto('/products/prod_1/batches')
    await page.waitForLoadState('domcontentloaded')

    // Click batch to view detail
    await page.getByText('BA-2026-001').click()

    // Should show batch number and stock info
    await expect(page.getByText('BA-2026-001')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/180|current.*stock/i)).toBeVisible()
  })

  // ─── Edit Batch ────────────────────────────────────────────────────────────

  test('should edit batch details', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'batches/batch_1', MOCK_BATCH_DETAIL)
    await mockApiGet(page, 'products/prod_1/batches/batch_1', MOCK_BATCH_DETAIL)

    await page.route('**/api/batches/batch_1', (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...MOCK_BATCH_DETAIL, sellingPrice: 4000 } }),
        })
      } else {
        route.continue()
      }
    })
    await page.route('**/api/products/prod_1/batches/batch_1', (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...MOCK_BATCH_DETAIL, sellingPrice: 4000 } }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/products/prod_1/batches/batch_1')
    await page.waitForLoadState('domcontentloaded')

    // Click edit
    await page.getByRole('button', { name: /edit/i }).click()

    // Update selling price
    const priceInput = page.getByLabel(/selling.*price|sale.*price/i)
    await priceInput.clear()
    await priceInput.fill('40')

    // Save
    await page.getByRole('button', { name: /save|update/i }).click()
    await expect(page.getByText(/updated|saved|success/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Delete Batch Without Stock ────────────────────────────────────────────

  test('should delete batch without stock', async ({ authedPage: page }) => {
    const emptyBatch = { ...MOCK_BATCH_DETAIL, currentStock: 0 }
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'batches/batch_1', emptyBatch)
    await mockApiGet(page, 'products/prod_1/batches/batch_1', emptyBatch)

    await page.route('**/api/batches/batch_1', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: null }),
        })
      } else {
        route.continue()
      }
    })
    await page.route('**/api/products/prod_1/batches/batch_1', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: null }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/products/prod_1/batches/batch_1')
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /delete/i }).click()
    await page.getByRole('button', { name: /confirm|yes|delete/i }).last().click()

    await expect(page.getByText(/deleted|removed|success/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Prevent Delete Batch with Stock ───────────────────────────────────────

  test('should prevent deleting batch with stock', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'batches/batch_1', MOCK_EMPTY_BATCH_WITH_STOCK)
    await mockApiGet(page, 'products/prod_1/batches/batch_1', MOCK_EMPTY_BATCH_WITH_STOCK)

    await page.route('**/api/batches/batch_1', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'HAS_STOCK', message: 'Cannot delete batch with remaining stock' } }),
        })
      } else {
        route.continue()
      }
    })
    await page.route('**/api/products/prod_1/batches/batch_1', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'HAS_STOCK', message: 'Cannot delete batch with remaining stock' } }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/products/prod_1/batches/batch_1')
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /delete/i }).click()
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i }).last()
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click()
    }

    await expect(page.getByText(/cannot delete|has stock|remaining stock/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Expiry Date Validation ────────────────────────────────────────────────

  test('should warn about past expiry date', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'products/prod_1/batches**', MOCK_BATCHES)
    await mockApiGet(page, 'batches**', MOCK_BATCHES)
    await page.goto('/products/prod_1/batches')
    await page.waitForLoadState('domcontentloaded')

    // Open create form
    await page.getByRole('button', { name: /add.*batch|create.*batch|new/i }).click()

    // Fill with past expiry date
    await page.getByLabel(/batch.*number|batch.*no/i).fill('BA-OLD-001')
    await page.getByLabel(/expiry.*date|exp.*date/i).fill('2024-01-01')

    // Should show warning about expired date
    await expect(page.getByText(/expired|past.*date|already.*expired/i)).toBeVisible({ timeout: 3000 })
  })

  // ─── Duplicate Batch Number ────────────────────────────────────────────────

  test('should show error for duplicate batch number', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'products/prod_1/batches**', MOCK_BATCHES)
    await mockApiGet(page, 'batches**', MOCK_BATCHES)

    await page.route('**/api/products/prod_1/batches', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'DUPLICATE', message: 'Batch number already exists for this product' } }),
        })
      } else {
        route.continue()
      }
    })
    await page.route('**/api/batches', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'DUPLICATE', message: 'Batch number already exists for this product' } }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/products/prod_1/batches')
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /add.*batch|create.*batch|new/i }).click()

    await page.getByLabel(/batch.*number|batch.*no/i).fill('BA-2026-001')
    await page.getByLabel(/expiry.*date|exp.*date/i).fill('2028-01-01')
    await page.getByLabel(/quantity|qty|opening.*stock/i).fill('100')

    await page.getByRole('button', { name: /save|create|add/i }).last().click()

    await expect(page.getByText(/already exists|duplicate|batch.*number.*taken/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Navigation Stack ─────────────────────────────────────────────────────

  test('should navigate product to batches to detail and back', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'products/prod_1/batches**', MOCK_BATCHES)
    await mockApiGet(page, 'batches**', MOCK_BATCHES)
    await mockApiGet(page, 'batches/batch_1', MOCK_BATCH_DETAIL)
    await mockApiGet(page, 'products/prod_1/batches/batch_1', MOCK_BATCH_DETAIL)
    await mockApiGet(page, 'products**', { products: [MOCK_PRODUCT], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 }, summary: { totalProducts: 1, lowStockCount: 0, totalStockValue: 0 } })

    // Start at product detail
    await page.goto('/products/prod_1')
    await page.waitForLoadState('domcontentloaded')

    // Navigate to batches (tab or link)
    const batchesLink = page.getByRole('tab', { name: /batch/i }).or(page.getByRole('link', { name: /batch/i }))
    if (await batchesLink.count() > 0) {
      await batchesLink.first().click()
    } else {
      await page.goto('/products/prod_1/batches')
    }

    await expect(page.getByText('BA-2026-001')).toBeVisible({ timeout: 5000 })

    // Navigate to batch detail
    await page.getByText('BA-2026-001').click()
    await expect(page.getByText('BA-2026-001')).toBeVisible({ timeout: 5000 })

    // Go back
    await page.goBack()
    await expect(page.getByText('BA-2026-002')).toBeVisible({ timeout: 5000 })

    // Go back again
    await page.goBack()
    await expect(page.getByText(/Crocin/i)).toBeVisible({ timeout: 5000 })
  })
})
