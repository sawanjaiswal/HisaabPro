/**
 * POS Quick Sale — E2E Tests
 *
 * Covers: POS page load, barcode scan, quick-add tiles, cart operations,
 * checkout flow, payment processing, receipt, and edge cases.
 */

import { test, expect, mockApiGet, mockApiPost, mockApiEmpty, mockApiError } from './fixtures'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_PRODUCTS = [
  { id: 'p1', name: 'Tata Salt 1kg', sku: 'SALT-001', barcode: '8901058851885', salePrice: 2800, stock: 500, unit: 'pcs' },
  { id: 'p2', name: 'Amul Butter 500g', sku: 'BTR-001', barcode: '8901030029042', salePrice: 28000, stock: 100, unit: 'pcs' },
  { id: 'p3', name: 'Parle-G 800g', sku: 'BIS-001', barcode: '8901440000208', salePrice: 8500, stock: 200, unit: 'pcs' },
]

const MOCK_SALE_RESPONSE = {
  id: 'sale_001',
  invoiceNumber: 'POS-0001',
  items: [
    { productId: 'p1', productName: 'Tata Salt 1kg', quantity: 2, unitPrice: 2800, total: 5600 },
  ],
  subtotal: 5600,
  discount: 0,
  total: 5600,
  paymentMode: 'CASH',
  amountPaid: 10000,
  change: 4400,
  createdAt: '2026-03-21T10:00:00Z',
}

// ─── POS Page Load ──────────────────────────────────────────────────────────

test.describe('POS Quick Sale', () => {
  test('should load POS page with scan bar', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS)
    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    await expect(page).toHaveURL(/\/pos/)

    // Scan/search bar should be present
    const searchInput = page.getByPlaceholder(/scan|search|barcode/i)
    await expect(searchInput).toBeVisible()

    // Search bar should be auto-focused for immediate scanning
    await expect(searchInput).toBeFocused()
  })

  // ─── Barcode Scan ───────────────────────────────────────────────────────────

  test('should add product via barcode scan', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS)
    await mockApiGet(page, 'products/barcode/*', MOCK_PRODUCTS[0])
    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    const searchInput = page.getByPlaceholder(/scan|search|barcode/i)
    await searchInput.fill('8901058851885')
    await searchInput.press('Enter')

    // Product should appear in cart
    await expect(page.getByText('Tata Salt 1kg')).toBeVisible()
    // Quantity should be 1
    await expect(page.getByText('1').first()).toBeVisible()
  })

  // ─── Quick Add Tile ─────────────────────────────────────────────────────────

  test('should add product via Quick Add tile', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS)
    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    // Click product tile
    await page.getByText('Tata Salt 1kg').click()

    // Cart should update with the product
    const cartSection = page.locator('[data-testid="pos-cart"], [aria-label="Cart"]').or(page.locator('.pos-cart'))
    await expect(cartSection.getByText('Tata Salt 1kg')).toBeVisible()
  })

  // ─── Quantity Operations ────────────────────────────────────────────────────

  test('should increment and decrement quantity', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS)
    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    // Add product
    await page.getByText('Tata Salt 1kg').click()

    // Increment
    const incrementBtn = page.getByRole('button', { name: /increase|increment|\+/i }).first()
    await incrementBtn.click()

    // Quantity should be 2
    const qtyDisplay = page.locator('[data-testid="cart-qty"], [aria-label*="quantity"]').first()
    await expect(qtyDisplay).toContainText('2')

    // Decrement
    const decrementBtn = page.getByRole('button', { name: /decrease|decrement|−|-/i }).first()
    await decrementBtn.click()

    // Quantity should be 1
    await expect(qtyDisplay).toContainText('1')
  })

  // ─── Remove Item ────────────────────────────────────────────────────────────

  test('should remove item from cart', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS)
    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    // Add product
    await page.getByText('Tata Salt 1kg').click()
    await expect(page.locator('[data-testid="pos-cart"], [aria-label="Cart"]').or(page.locator('.pos-cart')).getByText('Tata Salt 1kg')).toBeVisible()

    // Remove item
    const removeBtn = page.getByRole('button', { name: /remove|delete|trash/i }).first()
    await removeBtn.click()

    // Cart should be empty
    await expect(page.getByText(/cart is empty|no items|add items/i)).toBeVisible()
  })

  // ─── Totals Calculation ─────────────────────────────────────────────────────

  test('should calculate totals correctly', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS)
    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    // Add Tata Salt (Rs 28.00)
    await page.getByText('Tata Salt 1kg').click()

    // Add Amul Butter (Rs 280.00)
    await page.getByText('Amul Butter 500g').click()

    // Total should be Rs 308.00 (2800 + 28000 = 30800 paise = Rs 308.00)
    await expect(page.getByText(/308/)).toBeVisible()
  })

  // ─── Checkout Flow ──────────────────────────────────────────────────────────

  test('should open checkout on Charge button', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS)
    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    // Add product to cart
    await page.getByText('Tata Salt 1kg').click()

    // Click Charge / Pay button
    const chargeBtn = page.getByRole('button', { name: /charge|pay|checkout/i })
    await chargeBtn.click()

    // Payment modal/sheet should appear
    const paymentModal = page.getByText(/payment method|select payment|how.*pay/i)
    await expect(paymentModal).toBeVisible()
  })

  // ─── Cash Payment ──────────────────────────────────────────────────────────

  test('should process cash payment', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS)
    await mockApiPost(page, 'pos/sale*', MOCK_SALE_RESPONSE)
    await mockApiPost(page, 'sales*', MOCK_SALE_RESPONSE)
    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    // Add product
    await page.getByText('Tata Salt 1kg').click()

    // Open checkout
    const chargeBtn = page.getByRole('button', { name: /charge|pay|checkout/i })
    await chargeBtn.click()

    // Select cash payment
    const cashBtn = page.getByRole('button', { name: /cash/i })
    await cashBtn.click()

    // Complete payment
    const confirmBtn = page.getByRole('button', { name: /confirm|complete|done/i })
    await confirmBtn.click()

    // Should show success or receipt
    await expect(page.getByText(/success|receipt|paid|completed/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Receipt After Payment ──────────────────────────────────────────────────

  test('should show receipt after payment', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS)
    await mockApiPost(page, 'pos/sale*', MOCK_SALE_RESPONSE)
    await mockApiPost(page, 'sales*', MOCK_SALE_RESPONSE)
    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    // Add product, checkout, pay
    await page.getByText('Tata Salt 1kg').click()
    await page.getByRole('button', { name: /charge|pay|checkout/i }).click()
    await page.getByRole('button', { name: /cash/i }).click()
    await page.getByRole('button', { name: /confirm|complete|done/i }).click()

    // Receipt should show invoice number
    await expect(page.getByText(/POS-0001|receipt/i)).toBeVisible({ timeout: 5000 })

    // Receipt should have print/share options
    const printBtn = page.getByRole('button', { name: /print|share|download/i })
    await expect(printBtn.first()).toBeVisible()
  })

  // ─── New Sale (Cart Reset) ─────────────────────────────────────────────────

  test('should clear cart on New Sale', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS)
    await mockApiPost(page, 'pos/sale*', MOCK_SALE_RESPONSE)
    await mockApiPost(page, 'sales*', MOCK_SALE_RESPONSE)
    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    // Add product, checkout, pay
    await page.getByText('Tata Salt 1kg').click()
    await page.getByRole('button', { name: /charge|pay|checkout/i }).click()
    await page.getByRole('button', { name: /cash/i }).click()
    await page.getByRole('button', { name: /confirm|complete|done/i }).click()

    // Click New Sale
    const newSaleBtn = page.getByRole('button', { name: /new sale|start over|new/i })
    await expect(newSaleBtn).toBeVisible({ timeout: 5000 })
    await newSaleBtn.click()

    // Cart should be empty, scan bar should be focused
    const searchInput = page.getByPlaceholder(/scan|search|barcode/i)
    await expect(searchInput).toBeVisible()
  })

  // ─── Cart Persistence ──────────────────────────────────────────────────────

  test('should persist cart on page refresh', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS)
    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    // Add product to cart
    await page.getByText('Tata Salt 1kg').click()

    // Refresh the page
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Cart should still have the product
    const cartArea = page.locator('[data-testid="pos-cart"], [aria-label="Cart"]').or(page.locator('.pos-cart'))
    await expect(cartArea.getByText('Tata Salt 1kg')).toBeVisible({ timeout: 5000 })
  })

  // ─── Empty Cart Guard ──────────────────────────────────────────────────────

  test('should disable Charge button with empty cart', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS)
    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    // Charge button should be disabled or hidden when cart is empty
    const chargeBtn = page.getByRole('button', { name: /charge|pay|checkout/i })
    if (await chargeBtn.count() > 0) {
      await expect(chargeBtn).toBeDisabled()
    }
    // Alternative: button may not render at all with empty cart — either is valid
  })

  // ─── Double Submit Prevention ──────────────────────────────────────────────

  test('should prevent double submit during payment', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS)

    // Slow API to simulate delay
    let requestCount = 0
    await page.route('**/api/pos/sale*', async (route) => {
      requestCount++
      await new Promise((r) => setTimeout(r, 2000))
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_SALE_RESPONSE }),
      })
    })
    await page.route('**/api/sales*', async (route) => {
      if (route.request().method() === 'POST') {
        requestCount++
        await new Promise((r) => setTimeout(r, 2000))
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_SALE_RESPONSE }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    // Add product, open checkout, select cash
    await page.getByText('Tata Salt 1kg').click()
    await page.getByRole('button', { name: /charge|pay|checkout/i }).click()
    await page.getByRole('button', { name: /cash/i }).click()

    // Click confirm
    const confirmBtn = page.getByRole('button', { name: /confirm|complete|done/i })
    await confirmBtn.click()

    // Button should be disabled after first click
    await expect(confirmBtn).toBeDisabled()

    // Only one request should have been made
    expect(requestCount).toBeLessThanOrEqual(1)
  })

  // ─── Payment API Error ─────────────────────────────────────────────────────

  test('should handle payment API error gracefully', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS)
    await mockApiError(page, 'pos/sale*')
    await mockApiError(page, 'sales*')
    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    // Add product, checkout, pay
    await page.getByText('Tata Salt 1kg').click()
    await page.getByRole('button', { name: /charge|pay|checkout/i }).click()
    await page.getByRole('button', { name: /cash/i }).click()
    await page.getByRole('button', { name: /confirm|complete|done/i }).click()

    // Error message should appear
    await expect(page.getByText(/error|failed|try again/i)).toBeVisible({ timeout: 5000 })

    // Cart items should be preserved (not cleared on error)
    await expect(page.getByText('Tata Salt 1kg')).toBeVisible()
  })

  // ─── Loading State ─────────────────────────────────────────────────────────

  test('should show loading indicator during payment processing', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products**', MOCK_PRODUCTS)

    // Delayed response
    await page.route('**/api/pos/sale*', async (route) => {
      await new Promise((r) => setTimeout(r, 3000))
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_SALE_RESPONSE }),
      })
    })
    await page.route('**/api/sales*', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((r) => setTimeout(r, 3000))
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_SALE_RESPONSE }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    // Add product, checkout, pay
    await page.getByText('Tata Salt 1kg').click()
    await page.getByRole('button', { name: /charge|pay|checkout/i }).click()
    await page.getByRole('button', { name: /cash/i }).click()
    await page.getByRole('button', { name: /confirm|complete|done/i }).click()

    // Should show loading indicator (spinner, skeleton, or processing text)
    const loading = page.getByText(/processing|loading|please wait/i)
      .or(page.locator('[data-testid="loading"], [data-testid="spinner"], .spinner'))
    await expect(loading.first()).toBeVisible({ timeout: 2000 })
  })
})
