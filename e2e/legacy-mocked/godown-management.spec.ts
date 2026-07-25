/**
 * Godown (Warehouse) Management — E2E Tests
 *
 * Covers: CRUD operations, stock transfers between godowns,
 * validation, navigation, empty/loading/error states.
 */

import { test, expect, mockApiGet, mockApiPost, mockApiEmpty, mockApiError } from './fixtures'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_GODOWNS = [
  {
    id: 'gdn_1',
    name: 'Main Warehouse',
    address: '12 Industrial Area, Phase 1',
    phone: '9876543210',
    isDefault: true,
    stockCount: 45,
    totalStockValue: 1250000,
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'gdn_2',
    name: 'Retail Store',
    address: 'Shop 4, Market Road',
    phone: '9876543211',
    isDefault: false,
    stockCount: 12,
    totalStockValue: 350000,
    createdAt: '2026-02-01T00:00:00Z',
  },
]

const MOCK_GODOWN_DETAIL = {
  ...MOCK_GODOWNS[0],
  stocks: [
    { productId: 'p1', productName: 'Tata Salt 1kg', sku: 'SALT-001', quantity: 200, value: 560000 },
    { productId: 'p2', productName: 'Amul Butter 500g', sku: 'BTR-001', quantity: 50, value: 690000 },
  ],
}

const MOCK_EMPTY_GODOWN_DETAIL = {
  id: 'gdn_3',
  name: 'Empty Storage',
  address: '5 Back Lane',
  phone: null,
  isDefault: false,
  stockCount: 0,
  totalStockValue: 0,
  stocks: [],
  createdAt: '2026-03-01T00:00:00Z',
}

const MOCK_TRANSFER_RESPONSE = {
  id: 'txfr_001',
  fromGodownId: 'gdn_1',
  toGodownId: 'gdn_2',
  items: [{ productId: 'p1', productName: 'Tata Salt 1kg', quantity: 10 }],
  status: 'COMPLETED',
  createdAt: '2026-03-21T10:00:00Z',
}

// ─── Godown List ────────────────────────────────────────────────────────────

test.describe('Godown Management', () => {
  test('should show empty state with CTA when no godowns exist', async ({ authedPage: page }) => {
    await mockApiEmpty(page, 'godowns**')
    await page.goto('/godowns')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText(/no godown|no warehouse|add your first/i)).toBeVisible()
    const addBtn = page.getByRole('button', { name: /add.*godown|add.*warehouse|create/i })
    await expect(addBtn).toBeVisible()
  })

  test('should render godown list with data', async ({ authedPage: page }) => {
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)
    await page.goto('/godowns')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText('Main Warehouse')).toBeVisible()
    await expect(page.getByText('Retail Store')).toBeVisible()
  })

  // ─── Create Godown ────────────────────────────────────────────────────────

  test('should create a godown with validation', async ({ authedPage: page }) => {
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)
    const createdGodown = { id: 'gdn_new', name: 'New Storage', address: '99 New Road', phone: '9999999999', isDefault: false, stockCount: 0, totalStockValue: 0 }
    await mockApiPost(page, 'godowns*', createdGodown)
    await page.goto('/godowns')
    await page.waitForLoadState('domcontentloaded')

    // Open create form
    const addBtn = page.getByRole('button', { name: /add.*godown|add.*warehouse|create|new/i })
    await addBtn.click()

    // Try submitting empty form — should show validation
    const submitBtn = page.getByRole('button', { name: /save|create|add/i }).last()
    await submitBtn.click()
    await expect(page.getByText(/name.*required|enter.*name|required/i).first()).toBeVisible()

    // Fill valid data
    await page.getByLabel(/name/i).fill('New Storage')
    await page.getByLabel(/address/i).fill('99 New Road')

    // Submit
    await submitBtn.click()

    // Success toast or redirect
    await expect(page.getByText(/created|added|success/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── View Detail ───────────────────────────────────────────────────────────

  test('should show godown detail with stock list', async ({ authedPage: page }) => {
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)
    await mockApiGet(page, 'godowns/gdn_1', MOCK_GODOWN_DETAIL)
    await page.goto('/godowns')
    await page.waitForLoadState('domcontentloaded')

    // Navigate to detail
    await page.getByText('Main Warehouse').click()

    // Should show godown name and stock
    await expect(page.getByRole('heading', { name: /Main Warehouse/i })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Tata Salt 1kg')).toBeVisible()
    await expect(page.getByText('Amul Butter 500g')).toBeVisible()
  })

  // ─── Edit Godown ───────────────────────────────────────────────────────────

  test('should edit godown details', async ({ authedPage: page }) => {
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)
    await mockApiGet(page, 'godowns/gdn_1', MOCK_GODOWN_DETAIL)

    await page.route('**/api/godowns/gdn_1', (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...MOCK_GODOWN_DETAIL, name: 'Updated Warehouse' } }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/godowns/gdn_1')
    await page.waitForLoadState('domcontentloaded')

    // Click edit
    const editBtn = page.getByRole('button', { name: /edit/i })
    await editBtn.click()

    // Update name
    const nameInput = page.getByLabel(/name/i)
    await nameInput.clear()
    await nameInput.fill('Updated Warehouse')

    // Save
    await page.getByRole('button', { name: /save|update/i }).click()
    await expect(page.getByText(/updated|saved|success/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Delete Empty Godown ───────────────────────────────────────────────────

  test('should delete an empty godown with confirmation', async ({ authedPage: page }) => {
    await mockApiGet(page, 'godowns**', [...MOCK_GODOWNS, MOCK_EMPTY_GODOWN_DETAIL])
    await mockApiGet(page, 'godowns/gdn_3', MOCK_EMPTY_GODOWN_DETAIL)

    await page.route('**/api/godowns/gdn_3', (route) => {
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

    await page.goto('/godowns/gdn_3')
    await page.waitForLoadState('domcontentloaded')

    // Click delete
    const deleteBtn = page.getByRole('button', { name: /delete/i })
    await deleteBtn.click()

    // Confirmation dialog should appear
    await expect(page.getByText(/are you sure|confirm.*delete|will be.*lost/i)).toBeVisible()

    // Confirm deletion
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i }).last()
    await confirmBtn.click()

    // Should redirect or show success
    await expect(page.getByText(/deleted|removed|success/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Prevent Delete with Stock ─────────────────────────────────────────────

  test('should prevent deleting godown with stock', async ({ authedPage: page }) => {
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)
    await mockApiGet(page, 'godowns/gdn_1', MOCK_GODOWN_DETAIL)

    await page.route('**/api/godowns/gdn_1', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'HAS_STOCK', message: 'Cannot delete godown with existing stock. Transfer stock first.' } }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/godowns/gdn_1')
    await page.waitForLoadState('domcontentloaded')

    const deleteBtn = page.getByRole('button', { name: /delete/i })
    await deleteBtn.click()

    // Confirm deletion attempt
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i }).last()
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click()
    }

    // Error message should appear
    await expect(page.getByText(/cannot delete|has stock|transfer stock/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Stock Transfer ────────────────────────────────────────────────────────

  test('should transfer stock between godowns', async ({ authedPage: page }) => {
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)
    await mockApiGet(page, 'godowns/gdn_1', MOCK_GODOWN_DETAIL)
    await mockApiPost(page, 'godowns/transfer*', MOCK_TRANSFER_RESPONSE)
    await mockApiPost(page, 'stock-transfers*', MOCK_TRANSFER_RESPONSE)
    await page.goto('/godowns/gdn_1')
    await page.waitForLoadState('domcontentloaded')

    // Open transfer
    const transferBtn = page.getByRole('button', { name: /transfer/i })
    await transferBtn.click()

    // Select destination godown
    const destSelect = page.getByLabel(/destination|to.*godown|transfer.*to/i)
    await destSelect.click()
    await page.getByText('Retail Store').click()

    // Select product and quantity
    const productSelect = page.getByLabel(/product|item/i)
    if (await productSelect.isVisible()) {
      await productSelect.click()
      await page.getByText('Tata Salt 1kg').click()
    }

    const qtyInput = page.getByLabel(/quantity|qty/i)
    await qtyInput.fill('10')

    // Submit transfer
    await page.getByRole('button', { name: /transfer|confirm|submit/i }).last().click()

    // Success
    await expect(page.getByText(/transferred|success|completed/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Transfer Validation ───────────────────────────────────────────────────

  test('should validate stock transfer inputs', async ({ authedPage: page }) => {
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)
    await mockApiGet(page, 'godowns/gdn_1', MOCK_GODOWN_DETAIL)
    await page.goto('/godowns/gdn_1')
    await page.waitForLoadState('domcontentloaded')

    const transferBtn = page.getByRole('button', { name: /transfer/i })
    await transferBtn.click()

    // Try transfer with zero quantity
    const qtyInput = page.getByLabel(/quantity|qty/i)
    await qtyInput.fill('0')

    const submitBtn = page.getByRole('button', { name: /transfer|confirm|submit/i }).last()
    await submitBtn.click()

    // Should show validation error
    await expect(page.getByText(/greater than 0|minimum|at least 1|invalid/i)).toBeVisible()

    // Try quantity greater than available stock
    await qtyInput.clear()
    await qtyInput.fill('99999')
    await submitBtn.click()

    await expect(page.getByText(/exceeds|insufficient|not enough|available/i)).toBeVisible()
  })

  // ─── Navigation ────────────────────────────────────────────────────────────

  test('should navigate list to detail and back', async ({ authedPage: page }) => {
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)
    await mockApiGet(page, 'godowns/gdn_1', MOCK_GODOWN_DETAIL)
    await page.goto('/godowns')
    await page.waitForLoadState('domcontentloaded')

    // Go to detail
    await page.getByText('Main Warehouse').click()
    await expect(page.getByRole('heading', { name: /Main Warehouse/i })).toBeVisible({ timeout: 5000 })

    // Go back
    const backBtn = page.getByRole('button', { name: /back/i }).or(page.getByRole('link', { name: /back/i }))
    await backBtn.click()

    // Should be back on list
    await expect(page.getByText('Main Warehouse')).toBeVisible()
    await expect(page.getByText('Retail Store')).toBeVisible()
  })

  // ─── Invalid Godown ────────────────────────────────────────────────────────

  test('should show error for invalid godown ID', async ({ authedPage: page }) => {
    await mockApiError(page, 'godowns/nonexistent')
    await page.goto('/godowns/nonexistent')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText(/not found|error|doesn.*exist/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Loading + Error States ────────────────────────────────────────────────

  test('should show loading state then error with retry', async ({ authedPage: page }) => {
    await mockApiError(page, 'godowns**')
    await page.goto('/godowns')
    await page.waitForLoadState('domcontentloaded')

    // Error state should appear
    await expect(page.getByText(/error|failed|something went wrong/i)).toBeVisible({ timeout: 5000 })

    // Retry button should exist
    const retryBtn = page.getByRole('button', { name: /retry|try again/i })
    await expect(retryBtn).toBeVisible()
  })
})
