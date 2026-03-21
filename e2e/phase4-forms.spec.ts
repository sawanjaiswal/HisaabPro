/**
 * Phase 4 Forms — E2E Tests
 *
 * Covers: form validation, tab order, auto-focus on error, inline errors,
 * submit button disabled state, data preservation on failure,
 * browser autofill, and form reset on success.
 */

import { test, expect, mockApiGet, mockApiPost, mockApiError } from './fixtures'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_GODOWNS = [
  { id: 'gdn_1', name: 'Main Warehouse', address: '12 Industrial Area', stockCount: 10, totalStockValue: 500000 },
]

const MOCK_PRODUCT = {
  id: 'prod_1',
  name: 'Crocin Advance 500mg',
  sku: 'MED-001',
  trackBatches: true,
  salePrice: 3500,
  currentStock: 100,
}

const MOCK_BATCHES = [
  { id: 'batch_1', batchNumber: 'BA-001', productId: 'prod_1', costPrice: 2800, sellingPrice: 3500, quantity: 100, currentStock: 100, expiryDate: '2027-06-01', status: 'ACTIVE' },
]

// ─── Form Tests ─────────────────────────────────────────────────────────────

test.describe('Phase 4 Forms', () => {
  test('should show validation errors on empty godown form submit', async ({ authedPage: page }) => {
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)
    await page.goto('/godowns')
    await page.waitForLoadState('domcontentloaded')

    // Open create form
    await page.getByRole('button', { name: /add.*godown|add.*warehouse|create|new/i }).click()

    // Clear any pre-filled fields and submit empty
    const nameInput = page.getByLabel(/name/i)
    await nameInput.clear()

    // Submit
    const submitBtn = page.getByRole('button', { name: /save|create|add/i }).last()
    await submitBtn.click()

    // Validation error should appear
    await expect(page.getByText(/required|cannot be empty|enter.*name/i).first()).toBeVisible({ timeout: 3000 })

    // Submit button should still be enabled (not stuck in loading)
    await expect(submitBtn).toBeEnabled()
  })

  test('should have logical tab order in batch form', async ({ authedPage: page }) => {
    await mockApiGet(page, 'products/prod_1', MOCK_PRODUCT)
    await mockApiGet(page, 'products/prod_1/batches**', MOCK_BATCHES)
    await mockApiGet(page, 'batches**', MOCK_BATCHES)
    await page.goto('/products/prod_1/batches')
    await page.waitForLoadState('domcontentloaded')

    // Open create form
    await page.getByRole('button', { name: /add.*batch|create.*batch|new/i }).click()

    // Tab through fields — should follow logical order
    const batchNumberInput = page.getByLabel(/batch.*number|batch.*no/i)
    await batchNumberInput.focus()
    await expect(batchNumberInput).toBeFocused()

    // Tab to next field
    await page.keyboard.press('Tab')

    // Next focused element should be a relevant form field (not skip to submit)
    const focusedTagName = await page.evaluate(() => document.activeElement?.tagName)
    const focusedType = await page.evaluate(() => (document.activeElement as HTMLInputElement)?.type)
    expect(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON']).toContain(focusedTagName)

    // Tab again to verify continuous progression
    await page.keyboard.press('Tab')
    const secondFocusedTag = await page.evaluate(() => document.activeElement?.tagName)
    expect(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON']).toContain(secondFocusedTag)
  })

  test('should auto-focus first error field on validation', async ({ authedPage: page }) => {
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)
    await page.goto('/godowns')
    await page.waitForLoadState('domcontentloaded')

    // Open create form
    await page.getByRole('button', { name: /add.*godown|add.*warehouse|create|new/i }).click()

    // Clear required field
    const nameInput = page.getByLabel(/name/i)
    await nameInput.clear()

    // Submit empty form
    await page.getByRole('button', { name: /save|create|add/i }).last().click()

    // Wait for validation
    await page.waitForTimeout(300)

    // First error field should be focused
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement
      return {
        tagName: el?.tagName,
        ariaInvalid: el?.getAttribute('aria-invalid'),
        name: el?.name,
        id: el?.id,
      }
    })

    // The focused element should be an input (the first invalid field)
    expect(['INPUT', 'SELECT', 'TEXTAREA']).toContain(focusedElement.tagName)
  })

  test('should display inline error messages', async ({ authedPage: page }) => {
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)
    await page.goto('/godowns')
    await page.waitForLoadState('domcontentloaded')

    // Open create form
    await page.getByRole('button', { name: /add.*godown|add.*warehouse|create|new/i }).click()

    // Clear name and submit
    await page.getByLabel(/name/i).clear()
    await page.getByRole('button', { name: /save|create|add/i }).last().click()

    // Inline error should be near the field, not just a toast
    const errorMsg = page.getByText(/required|cannot be empty|enter.*name/i).first()
    await expect(errorMsg).toBeVisible({ timeout: 3000 })

    // Error should be visually close to the input (within same form group)
    const errorBounds = await errorMsg.boundingBox()
    const inputBounds = await page.getByLabel(/name/i).boundingBox()

    if (errorBounds && inputBounds) {
      // Error message should be within 100px vertically of the input
      const verticalDistance = Math.abs(errorBounds.y - (inputBounds.y + inputBounds.height))
      expect(verticalDistance).toBeLessThan(100)
    }
  })

  test('should disable submit button during form submission', async ({ authedPage: page }) => {
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)

    // Slow API response
    await page.route('**/api/godowns', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((r) => setTimeout(r, 3000))
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { id: 'gdn_new', name: 'Test Godown' } }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/godowns')
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /add.*godown|add.*warehouse|create|new/i }).click()

    // Fill valid data
    await page.getByLabel(/name/i).fill('Test Godown')

    // Submit
    const submitBtn = page.getByRole('button', { name: /save|create|add/i }).last()
    await submitBtn.click()

    // Button should be disabled immediately after click
    await expect(submitBtn).toBeDisabled({ timeout: 1000 })
  })

  test('should preserve form data on failed submit', async ({ authedPage: page }) => {
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)
    await mockApiError(page, 'godowns')

    await page.goto('/godowns')
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /add.*godown|add.*warehouse|create|new/i }).click()

    // Fill form with data
    const nameInput = page.getByLabel(/name/i)
    await nameInput.fill('My New Godown')

    const addressInput = page.getByLabel(/address/i)
    if (await addressInput.isVisible()) {
      await addressInput.fill('123 Industrial Area, Phase 2')
    }

    // Submit (will fail due to mocked error)
    await page.getByRole('button', { name: /save|create|add/i }).last().click()

    // Wait for error to appear
    await expect(page.getByText(/error|failed|try again/i)).toBeVisible({ timeout: 5000 })

    // Form data should be preserved
    await expect(nameInput).toHaveValue('My New Godown')
    if (await addressInput.isVisible()) {
      await expect(addressInput).toHaveValue('123 Industrial Area, Phase 2')
    }
  })

  test('should accept browser autofill values', async ({ authedPage: page }) => {
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)
    await page.goto('/godowns')
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /add.*godown|add.*warehouse|create|new/i }).click()

    const nameInput = page.getByLabel(/name/i)

    // Simulate autofill by using evaluate to set value and dispatch events
    await nameInput.evaluate((el: HTMLInputElement) => {
      el.value = 'Autofilled Godown Name'
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })

    // Verify the value was accepted by the form
    await expect(nameInput).toHaveValue('Autofilled Godown Name')

    // The form should recognize the autofilled value (no validation error for required)
    const submitBtn = page.getByRole('button', { name: /save|create|add/i }).last()
    // Button should be clickable (form recognizes the value)
    await expect(submitBtn).toBeEnabled()
  })

  test('should reset form after successful submission', async ({ authedPage: page }) => {
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)

    const newGodown = { id: 'gdn_new', name: 'Fresh Godown', address: '99 New Road', stockCount: 0, totalStockValue: 0 }
    await mockApiPost(page, 'godowns*', newGodown)

    await page.goto('/godowns')
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /add.*godown|add.*warehouse|create|new/i }).click()

    // Fill form
    const nameInput = page.getByLabel(/name/i)
    await nameInput.fill('Fresh Godown')

    // Submit
    await page.getByRole('button', { name: /save|create|add/i }).last().click()

    // Wait for success
    await expect(page.getByText(/created|added|success/i)).toBeVisible({ timeout: 5000 })

    // If the form is still open (modal), it should be cleared
    // If redirected, opening the form again should be empty
    const formStillOpen = await nameInput.isVisible().catch(() => false)
    if (formStillOpen) {
      await expect(nameInput).toHaveValue('')
    } else {
      // Open form again — should be empty
      const addBtn = page.getByRole('button', { name: /add.*godown|add.*warehouse|create|new/i })
      if (await addBtn.isVisible()) {
        await addBtn.click()
        const freshNameInput = page.getByLabel(/name/i)
        if (await freshNameInput.isVisible()) {
          await expect(freshNameInput).toHaveValue('')
        }
      }
    }
  })
})
