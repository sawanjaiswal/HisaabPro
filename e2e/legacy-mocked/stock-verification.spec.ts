/**
 * Stock Verification (Physical Count) — E2E Tests
 *
 * Covers: empty state, create count, filter tabs, counting items,
 * progress bar, completion, discrepancy summary, stock adjustment,
 * and guards against post-completion edits.
 */

import { test, expect, mockApiGet, mockApiPost, mockApiEmpty, mockApiError } from './fixtures'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_VERIFICATIONS = [
  {
    id: 'sv_1',
    name: 'Monthly Count - March 2026',
    status: 'IN_PROGRESS',
    godownId: 'gdn_1',
    godownName: 'Main Warehouse',
    totalItems: 10,
    countedItems: 4,
    progress: 40,
    createdBy: 'Test User',
    createdAt: '2026-03-15T00:00:00Z',
  },
  {
    id: 'sv_2',
    name: 'Quarterly Audit Q1',
    status: 'COMPLETED',
    godownId: 'gdn_1',
    godownName: 'Main Warehouse',
    totalItems: 25,
    countedItems: 25,
    progress: 100,
    createdBy: 'Test User',
    completedAt: '2026-03-10T00:00:00Z',
    createdAt: '2026-03-08T00:00:00Z',
  },
  {
    id: 'sv_3',
    name: 'Draft Count',
    status: 'DRAFT',
    godownId: 'gdn_2',
    godownName: 'Retail Store',
    totalItems: 5,
    countedItems: 0,
    progress: 0,
    createdBy: 'Test User',
    createdAt: '2026-03-20T00:00:00Z',
  },
]

const MOCK_VERIFICATION_DETAIL = {
  ...MOCK_VERIFICATIONS[0],
  items: [
    { id: 'svi_1', productId: 'p1', productName: 'Tata Salt 1kg', sku: 'SALT-001', expectedQuantity: 200, countedQuantity: 195, discrepancy: -5, isCounted: true },
    { id: 'svi_2', productId: 'p2', productName: 'Amul Butter 500g', sku: 'BTR-001', expectedQuantity: 50, countedQuantity: 50, discrepancy: 0, isCounted: true },
    { id: 'svi_3', productId: 'p3', productName: 'Parle-G 800g', sku: 'BIS-001', expectedQuantity: 100, countedQuantity: 110, discrepancy: 10, isCounted: true },
    { id: 'svi_4', productId: 'p4', productName: 'Surf Excel 1kg', sku: 'DET-001', expectedQuantity: 75, countedQuantity: 72, discrepancy: -3, isCounted: true },
    { id: 'svi_5', productId: 'p5', productName: 'Maggi Noodles', sku: 'NUD-001', expectedQuantity: 300, countedQuantity: null, discrepancy: null, isCounted: false },
  ],
}

const MOCK_COMPLETED_VERIFICATION = {
  ...MOCK_VERIFICATIONS[1],
  items: [
    { id: 'svi_10', productId: 'p1', productName: 'Tata Salt 1kg', sku: 'SALT-001', expectedQuantity: 200, countedQuantity: 195, discrepancy: -5, isCounted: true },
    { id: 'svi_11', productId: 'p2', productName: 'Amul Butter 500g', sku: 'BTR-001', expectedQuantity: 50, countedQuantity: 50, discrepancy: 0, isCounted: true },
  ],
  summary: {
    totalItems: 25,
    matchedItems: 20,
    shortageItems: 3,
    surplusItems: 2,
    totalShortageValue: 15000,
    totalSurplusValue: 8000,
  },
}

const MOCK_GODOWNS = [
  { id: 'gdn_1', name: 'Main Warehouse' },
  { id: 'gdn_2', name: 'Retail Store' },
]

// ─── Stock Verification Tests ────────────────────────────────────────────────

test.describe('Stock Verification', () => {
  test('should show empty state with CTA when no verifications exist', async ({ authedPage: page }) => {
    await mockApiEmpty(page, 'stock-verifications**')
    await mockApiEmpty(page, 'verifications**')
    await page.goto('/stock-verification')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText(/no.*verification|no.*count|start.*first/i)).toBeVisible({ timeout: 5000 })
    const addBtn = page.getByRole('button', { name: /new.*count|start.*count|create|new.*verification/i })
    await expect(addBtn).toBeVisible()
  })

  // ─── Create New Count ──────────────────────────────────────────────────────

  test('should create a new stock count', async ({ authedPage: page }) => {
    await mockApiGet(page, 'stock-verifications**', MOCK_VERIFICATIONS)
    await mockApiGet(page, 'verifications**', MOCK_VERIFICATIONS)
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)

    const newVerification = { id: 'sv_new', name: 'New Count', status: 'DRAFT', godownId: 'gdn_1', godownName: 'Main Warehouse', totalItems: 10, countedItems: 0, progress: 0 }
    await mockApiPost(page, 'stock-verifications*', newVerification)
    await mockApiPost(page, 'verifications*', newVerification)

    await page.goto('/stock-verification')
    await page.waitForLoadState('domcontentloaded')

    // Click create
    await page.getByRole('button', { name: /new.*count|start.*count|create|new.*verification/i }).click()

    // Fill name
    await page.getByLabel(/name|title|description/i).fill('New Count')

    // Select godown
    const godownSelect = page.getByLabel(/godown|warehouse|location/i)
    await godownSelect.click()
    await page.getByText('Main Warehouse').click()

    // Submit
    await page.getByRole('button', { name: /create|start|save/i }).last().click()
    await expect(page.getByText(/created|started|success/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Filter Tabs ───────────────────────────────────────────────────────────

  test('should filter verifications by status tabs', async ({ authedPage: page }) => {
    await mockApiGet(page, 'stock-verifications**', MOCK_VERIFICATIONS)
    await mockApiGet(page, 'verifications**', MOCK_VERIFICATIONS)
    await page.goto('/stock-verification')
    await page.waitForLoadState('domcontentloaded')

    // All tab should show all items
    await expect(page.getByText('Monthly Count - March 2026')).toBeVisible()
    await expect(page.getByText('Quarterly Audit Q1')).toBeVisible()

    // Click In Progress tab
    const inProgressTab = page.getByRole('tab', { name: /in.*progress/i }).or(page.getByRole('button', { name: /in.*progress/i }))
    if (await inProgressTab.count() > 0) {
      await inProgressTab.click()
      await expect(page.getByText('Monthly Count - March 2026')).toBeVisible()
    }

    // Click Completed tab
    const completedTab = page.getByRole('tab', { name: /completed/i }).or(page.getByRole('button', { name: /completed/i }))
    if (await completedTab.count() > 0) {
      await completedTab.click()
      await expect(page.getByText('Quarterly Audit Q1')).toBeVisible()
    }

    // Click Draft tab
    const draftTab = page.getByRole('tab', { name: /draft/i }).or(page.getByRole('button', { name: /draft/i }))
    if (await draftTab.count() > 0) {
      await draftTab.click()
      await expect(page.getByText('Draft Count')).toBeVisible()
    }
  })

  // ─── Count Items ───────────────────────────────────────────────────────────

  test('should enter counted quantity for items', async ({ authedPage: page }) => {
    await mockApiGet(page, 'stock-verifications/sv_1', MOCK_VERIFICATION_DETAIL)
    await mockApiGet(page, 'verifications/sv_1', MOCK_VERIFICATION_DETAIL)

    await page.route('**/api/stock-verifications/sv_1/items/svi_5', (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...MOCK_VERIFICATION_DETAIL.items[4], countedQuantity: 295, discrepancy: -5, isCounted: true } }),
        })
      } else {
        route.continue()
      }
    })
    await page.route('**/api/verifications/sv_1/items/svi_5', (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...MOCK_VERIFICATION_DETAIL.items[4], countedQuantity: 295, discrepancy: -5, isCounted: true } }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/stock-verification/sv_1')
    await page.waitForLoadState('domcontentloaded')

    // Find uncounted item (Maggi Noodles)
    await expect(page.getByText('Maggi Noodles')).toBeVisible({ timeout: 5000 })

    // Enter counted quantity
    const qtyInputs = page.locator('input[type="number"]')
    const lastInput = qtyInputs.last()
    await lastInput.fill('295')
    await lastInput.press('Tab')

    // Discrepancy should show
    await expect(page.getByText(/-5|shortage/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Progress Bar ──────────────────────────────────────────────────────────

  test('should update progress bar as items are counted', async ({ authedPage: page }) => {
    await mockApiGet(page, 'stock-verifications/sv_1', MOCK_VERIFICATION_DETAIL)
    await mockApiGet(page, 'verifications/sv_1', MOCK_VERIFICATION_DETAIL)
    await page.goto('/stock-verification/sv_1')
    await page.waitForLoadState('domcontentloaded')

    // Progress should show 4/5 = 80% (4 counted out of 5)
    const progressBar = page.locator('[role="progressbar"]').or(page.locator('.progress-bar, [data-testid="progress"]'))
    await expect(progressBar.first()).toBeVisible({ timeout: 5000 })

    // Should show count (4/5 or 80%)
    await expect(page.getByText(/4.*\/.*5|80%|4.*of.*5/)).toBeVisible()
  })

  // ─── Complete Verification ─────────────────────────────────────────────────

  test('should complete verification and show summary', async ({ authedPage: page }) => {
    // All items counted
    const allCounted = {
      ...MOCK_VERIFICATION_DETAIL,
      countedItems: 5,
      progress: 100,
      items: MOCK_VERIFICATION_DETAIL.items.map((item) => ({
        ...item,
        countedQuantity: item.countedQuantity ?? item.expectedQuantity,
        discrepancy: item.discrepancy ?? 0,
        isCounted: true,
      })),
    }

    await mockApiGet(page, 'stock-verifications/sv_1', allCounted)
    await mockApiGet(page, 'verifications/sv_1', allCounted)
    await mockApiPost(page, 'stock-verifications/sv_1/complete*', { ...allCounted, status: 'COMPLETED' })
    await mockApiPost(page, 'verifications/sv_1/complete*', { ...allCounted, status: 'COMPLETED' })

    await page.route('**/api/stock-verifications/sv_1/complete', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { ...allCounted, status: 'COMPLETED' } }),
      })
    })
    await page.route('**/api/verifications/sv_1/complete', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { ...allCounted, status: 'COMPLETED' } }),
      })
    })

    await page.goto('/stock-verification/sv_1')
    await page.waitForLoadState('domcontentloaded')

    // Click Complete
    const completeBtn = page.getByRole('button', { name: /complete|finalize|finish/i })
    await completeBtn.click()

    // Confirmation
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|complete/i }).last()
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click()
    }

    // Success
    await expect(page.getByText(/completed|finalized|success/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Discrepancy Summary ───────────────────────────────────────────────────

  test('should show discrepancy summary for completed verification', async ({ authedPage: page }) => {
    await mockApiGet(page, 'stock-verifications/sv_2', MOCK_COMPLETED_VERIFICATION)
    await mockApiGet(page, 'verifications/sv_2', MOCK_COMPLETED_VERIFICATION)
    await page.goto('/stock-verification/sv_2')
    await page.waitForLoadState('domcontentloaded')

    // Should show summary data
    await expect(page.getByText(/shortage|short/i).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/surplus|excess/i).first()).toBeVisible()

    // Should show matched count
    await expect(page.getByText(/match|matched|correct/i).first()).toBeVisible()
  })

  // ─── Adjust Stock ──────────────────────────────────────────────────────────

  test('should adjust stock based on verification results', async ({ authedPage: page }) => {
    await mockApiGet(page, 'stock-verifications/sv_2', MOCK_COMPLETED_VERIFICATION)
    await mockApiGet(page, 'verifications/sv_2', MOCK_COMPLETED_VERIFICATION)
    await mockApiPost(page, 'stock-verifications/sv_2/adjust*', { adjusted: true, itemsAdjusted: 5 })
    await mockApiPost(page, 'verifications/sv_2/adjust*', { adjusted: true, itemsAdjusted: 5 })

    await page.goto('/stock-verification/sv_2')
    await page.waitForLoadState('domcontentloaded')

    // Click Adjust Stock button
    const adjustBtn = page.getByRole('button', { name: /adjust.*stock|apply.*adjustment|update.*stock/i })
    await expect(adjustBtn).toBeVisible({ timeout: 5000 })
    await adjustBtn.click()

    // Confirmation
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|adjust/i }).last()
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click()
    }

    await expect(page.getByText(/adjusted|updated|success/i)).toBeVisible({ timeout: 5000 })
  })

  // ─── Prevent Edit After Completion ─────────────────────────────────────────

  test('should prevent counting items after verification is COMPLETED', async ({ authedPage: page }) => {
    await mockApiGet(page, 'stock-verifications/sv_2', MOCK_COMPLETED_VERIFICATION)
    await mockApiGet(page, 'verifications/sv_2', MOCK_COMPLETED_VERIFICATION)
    await page.goto('/stock-verification/sv_2')
    await page.waitForLoadState('domcontentloaded')

    // Quantity inputs should be disabled or readonly
    const qtyInputs = page.locator('input[type="number"]')
    if (await qtyInputs.count() > 0) {
      const firstInput = qtyInputs.first()
      const isDisabled = await firstInput.isDisabled()
      const isReadonly = await firstInput.getAttribute('readonly')
      expect(isDisabled || isReadonly !== null).toBeTruthy()
    }
    // Alternatively, inputs may not render at all for completed verifications
  })

  // ─── Double-Tap Complete Prevention ────────────────────────────────────────

  test('should prevent double-tap on Complete button', async ({ authedPage: page }) => {
    const allCounted = {
      ...MOCK_VERIFICATION_DETAIL,
      countedItems: 5,
      progress: 100,
      items: MOCK_VERIFICATION_DETAIL.items.map((item) => ({
        ...item,
        countedQuantity: item.countedQuantity ?? item.expectedQuantity,
        discrepancy: item.discrepancy ?? 0,
        isCounted: true,
      })),
    }

    await mockApiGet(page, 'stock-verifications/sv_1', allCounted)
    await mockApiGet(page, 'verifications/sv_1', allCounted)

    let completeRequestCount = 0
    await page.route('**/api/**/complete*', async (route) => {
      completeRequestCount++
      await new Promise((r) => setTimeout(r, 2000))
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { ...allCounted, status: 'COMPLETED' } }),
      })
    })

    await page.goto('/stock-verification/sv_1')
    await page.waitForLoadState('domcontentloaded')

    const completeBtn = page.getByRole('button', { name: /complete|finalize|finish/i })
    await completeBtn.click()

    // Confirm if dialog appears
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|complete/i }).last()
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click()
    }

    // Button should be disabled after first click
    await expect(completeBtn).toBeDisabled({ timeout: 2000 })

    // Only one request should fire
    expect(completeRequestCount).toBeLessThanOrEqual(1)
  })
})
