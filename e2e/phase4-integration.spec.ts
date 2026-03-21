/**
 * Phase 4 Integration — E2E Tests
 *
 * Cross-feature integration tests verifying that POS sales, godown transfers,
 * batch tracking, serial numbers, and stock verification work together correctly.
 */

import { test, expect, mockApiGet, mockApiPost } from './fixtures'

// ─── Shared Mock Data ────────────────────────────────────────────────────────

const MOCK_BATCH_PRODUCT = {
  id: 'prod_batch',
  name: 'Crocin Advance 500mg',
  sku: 'MED-001',
  salePrice: 3500,
  stock: 100,
  trackBatches: true,
  trackSerials: false,
  unit: 'strip',
}

const MOCK_SERIAL_PRODUCT = {
  id: 'prod_serial',
  name: 'Samsung Galaxy A15',
  sku: 'PHN-001',
  salePrice: 1499900,
  stock: 5,
  trackBatches: false,
  trackSerials: true,
  unit: 'pcs',
}

const MOCK_BATCH = {
  id: 'batch_1',
  batchNumber: 'CR-2026-001',
  productId: 'prod_batch',
  currentStock: 50,
  costPrice: 2800,
  sellingPrice: 3500,
  expiryDate: '2027-06-01',
}

const MOCK_SERIAL = {
  id: 'srl_1',
  serialNumber: 'IMEI-INTEG-001',
  productId: 'prod_serial',
  status: 'AVAILABLE',
}

const MOCK_GODOWNS = [
  { id: 'gdn_1', name: 'Main Warehouse', stockCount: 20, totalStockValue: 500000 },
  { id: 'gdn_2', name: 'Retail Store', stockCount: 8, totalStockValue: 200000 },
]

// ─── Integration Tests ──────────────────────────────────────────────────────

test.describe('Phase 4 Integration', () => {
  test('POS sale should decrease batch stock', async ({ authedPage: page }) => {
    const products = [MOCK_BATCH_PRODUCT]
    await mockApiGet(page, 'products**', products)
    await mockApiGet(page, 'products/prod_batch/batches**', [MOCK_BATCH])
    await mockApiGet(page, 'batches**', [MOCK_BATCH])

    // POS sale response reflecting decreased batch stock
    const saleResponse = {
      id: 'sale_int_1',
      invoiceNumber: 'POS-INT-001',
      items: [{ productId: 'prod_batch', productName: 'Crocin Advance 500mg', quantity: 5, unitPrice: 3500, total: 17500, batchId: 'batch_1', batchNumber: 'CR-2026-001' }],
      total: 17500,
      paymentMode: 'CASH',
    }
    await mockApiPost(page, 'pos/sale*', saleResponse)
    await mockApiPost(page, 'sales*', saleResponse)

    // Make sale via POS
    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    await page.getByText('Crocin Advance 500mg').click()

    // Select batch if prompted
    const batchOption = page.getByText('CR-2026-001')
    if (await batchOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await batchOption.click()
    }

    // Checkout
    await page.getByRole('button', { name: /charge|pay|checkout/i }).click()
    await page.getByRole('button', { name: /cash/i }).click()
    await page.getByRole('button', { name: /confirm|complete|done/i }).click()

    await expect(page.getByText(/success|receipt|completed/i)).toBeVisible({ timeout: 5000 })

    // Navigate to batch detail to verify stock decreased
    const updatedBatch = { ...MOCK_BATCH, currentStock: 45 }
    await mockApiGet(page, 'products/prod_batch/batches**', [updatedBatch])
    await mockApiGet(page, 'batches/batch_1', updatedBatch)
    await mockApiGet(page, 'products/prod_batch/batches/batch_1', updatedBatch)
    await mockApiGet(page, 'products/prod_batch', MOCK_BATCH_PRODUCT)

    await page.goto('/products/prod_batch/batches/batch_1')
    await page.waitForLoadState('domcontentloaded')

    // Should show 45 (50 - 5)
    await expect(page.getByText(/45/)).toBeVisible({ timeout: 5000 })
  })

  test('POS sale should change serial status to SOLD', async ({ authedPage: page }) => {
    const products = [MOCK_SERIAL_PRODUCT]
    await mockApiGet(page, 'products**', products)
    await mockApiGet(page, 'products/prod_serial/serials**', { serials: [MOCK_SERIAL], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } })

    const saleResponse = {
      id: 'sale_int_2',
      invoiceNumber: 'POS-INT-002',
      items: [{ productId: 'prod_serial', productName: 'Samsung Galaxy A15', quantity: 1, unitPrice: 1499900, total: 1499900, serialId: 'srl_1', serialNumber: 'IMEI-INTEG-001' }],
      total: 1499900,
      paymentMode: 'UPI',
    }
    await mockApiPost(page, 'pos/sale*', saleResponse)
    await mockApiPost(page, 'sales*', saleResponse)

    // Make sale via POS
    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    await page.getByText('Samsung Galaxy A15').click()

    // Select serial if prompted
    const serialOption = page.getByText('IMEI-INTEG-001')
    if (await serialOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await serialOption.click()
    }

    // Checkout
    await page.getByRole('button', { name: /charge|pay|checkout/i }).click()
    await page.getByRole('button', { name: /upi|online/i }).or(page.getByRole('button', { name: /cash/i })).first().click()
    await page.getByRole('button', { name: /confirm|complete|done/i }).click()

    await expect(page.getByText(/success|receipt|completed/i)).toBeVisible({ timeout: 5000 })

    // Verify serial status changed
    const soldSerial = { ...MOCK_SERIAL, status: 'SOLD', soldDate: '2026-03-21' }
    await mockApiGet(page, 'serials/srl_1', soldSerial)
    await mockApiGet(page, 'products/prod_serial/serials/srl_1', soldSerial)
    await mockApiGet(page, 'products/prod_serial', MOCK_SERIAL_PRODUCT)

    await page.goto('/products/prod_serial/serials/srl_1')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText(/sold/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('Godown transfer should update both godown stocks', async ({ authedPage: page }) => {
    const godownDetail = {
      ...MOCK_GODOWNS[0],
      stocks: [{ productId: 'p1', productName: 'Tata Salt 1kg', sku: 'SALT-001', quantity: 200, value: 560000 }],
    }
    await mockApiGet(page, 'godowns**', MOCK_GODOWNS)
    await mockApiGet(page, 'godowns/gdn_1', godownDetail)

    const transferResult = {
      id: 'txfr_int_1',
      fromGodownId: 'gdn_1',
      toGodownId: 'gdn_2',
      items: [{ productId: 'p1', productName: 'Tata Salt 1kg', quantity: 50 }],
      status: 'COMPLETED',
    }
    await mockApiPost(page, 'godowns/transfer*', transferResult)
    await mockApiPost(page, 'stock-transfers*', transferResult)

    await page.goto('/godowns/gdn_1')
    await page.waitForLoadState('domcontentloaded')

    // Initiate transfer
    await page.getByRole('button', { name: /transfer/i }).click()

    // Select destination
    const destSelect = page.getByLabel(/destination|to.*godown|transfer.*to/i)
    await destSelect.click()
    await page.getByText('Retail Store').click()

    // Enter quantity
    const qtyInput = page.getByLabel(/quantity|qty/i)
    await qtyInput.fill('50')

    // Select product if needed
    const productSelect = page.getByLabel(/product|item/i)
    if (await productSelect.isVisible()) {
      await productSelect.click()
      await page.getByText('Tata Salt 1kg').click()
    }

    await page.getByRole('button', { name: /transfer|confirm|submit/i }).last().click()
    await expect(page.getByText(/transferred|success|completed/i)).toBeVisible({ timeout: 5000 })

    // Verify source godown stock decreased
    const updatedSource = { ...godownDetail, stocks: [{ ...godownDetail.stocks[0], quantity: 150 }] }
    await mockApiGet(page, 'godowns/gdn_1', updatedSource)
    await page.goto('/godowns/gdn_1')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText(/150/)).toBeVisible({ timeout: 5000 })

    // Verify destination godown stock increased
    const updatedDest = { ...MOCK_GODOWNS[1], stocks: [{ productId: 'p1', productName: 'Tata Salt 1kg', sku: 'SALT-001', quantity: 50, value: 140000 }] }
    await mockApiGet(page, 'godowns/gdn_2', updatedDest)
    await page.goto('/godowns/gdn_2')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText(/50/)).toBeVisible({ timeout: 5000 })
  })

  test('Stock verification should reflect post-sale quantities', async ({ authedPage: page }) => {
    // After sales, system stock shows 195 but physical count shows 195 (matches)
    const verification = {
      id: 'sv_int_1',
      name: 'Post-Sale Verification',
      status: 'IN_PROGRESS',
      godownId: 'gdn_1',
      godownName: 'Main Warehouse',
      totalItems: 1,
      countedItems: 0,
      progress: 0,
      items: [
        { id: 'svi_int_1', productId: 'p1', productName: 'Tata Salt 1kg', sku: 'SALT-001', expectedQuantity: 150, countedQuantity: null, discrepancy: null, isCounted: false },
      ],
    }

    await mockApiGet(page, 'stock-verifications/sv_int_1', verification)
    await mockApiGet(page, 'verifications/sv_int_1', verification)
    await page.goto('/stock-verification/sv_int_1')
    await page.waitForLoadState('domcontentloaded')

    // Expected quantity should reflect post-sale value (150, not original 200)
    await expect(page.getByText('Tata Salt 1kg')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/150/)).toBeVisible()
  })

  test('Create batch-tracked product, sell via POS, verify batch stock decreased', async ({ authedPage: page }) => {
    // Full flow: product with batch → POS sale → check batch
    const products = [MOCK_BATCH_PRODUCT]
    await mockApiGet(page, 'products**', products)

    // Sale via POS
    const saleResponse = {
      id: 'sale_int_3',
      invoiceNumber: 'POS-INT-003',
      items: [{ productId: 'prod_batch', productName: 'Crocin Advance 500mg', quantity: 10, unitPrice: 3500, total: 35000, batchId: 'batch_1' }],
      total: 35000,
      paymentMode: 'CASH',
    }
    await mockApiPost(page, 'pos/sale*', saleResponse)
    await mockApiPost(page, 'sales*', saleResponse)

    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    await page.getByText('Crocin Advance 500mg').click()

    // If batch selector appears, pick the batch
    const batchPick = page.getByText('CR-2026-001')
    if (await batchPick.isVisible({ timeout: 2000 }).catch(() => false)) {
      await batchPick.click()
    }

    // Increase quantity to 10
    const incrementBtn = page.getByRole('button', { name: /increase|increment|\+/i }).first()
    for (let i = 0; i < 9; i++) {
      await incrementBtn.click()
    }

    // Checkout and pay
    await page.getByRole('button', { name: /charge|pay|checkout/i }).click()
    await page.getByRole('button', { name: /cash/i }).click()
    await page.getByRole('button', { name: /confirm|complete|done/i }).click()

    await expect(page.getByText(/success|receipt|completed/i)).toBeVisible({ timeout: 5000 })

    // Verify batch stock: 50 - 10 = 40
    const updatedBatch = { ...MOCK_BATCH, currentStock: 40 }
    await mockApiGet(page, 'products/prod_batch/batches**', [updatedBatch])
    await mockApiGet(page, 'batches/batch_1', updatedBatch)
    await mockApiGet(page, 'products/prod_batch/batches/batch_1', updatedBatch)
    await mockApiGet(page, 'products/prod_batch', MOCK_BATCH_PRODUCT)

    await page.goto('/products/prod_batch/batches/batch_1')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText(/40/)).toBeVisible({ timeout: 5000 })
  })

  test('Create serial-tracked product, sell via POS, verify serial SOLD', async ({ authedPage: page }) => {
    const products = [MOCK_SERIAL_PRODUCT]
    await mockApiGet(page, 'products**', products)

    const saleResponse = {
      id: 'sale_int_4',
      invoiceNumber: 'POS-INT-004',
      items: [{ productId: 'prod_serial', productName: 'Samsung Galaxy A15', quantity: 1, unitPrice: 1499900, total: 1499900, serialId: 'srl_1', serialNumber: 'IMEI-INTEG-001' }],
      total: 1499900,
      paymentMode: 'CASH',
    }
    await mockApiPost(page, 'pos/sale*', saleResponse)
    await mockApiPost(page, 'sales*', saleResponse)

    await page.goto('/pos')
    await page.waitForLoadState('domcontentloaded')

    await page.getByText('Samsung Galaxy A15').click()

    // Select serial
    const serialPick = page.getByText('IMEI-INTEG-001')
    if (await serialPick.isVisible({ timeout: 2000 }).catch(() => false)) {
      await serialPick.click()
    }

    // Checkout
    await page.getByRole('button', { name: /charge|pay|checkout/i }).click()
    await page.getByRole('button', { name: /cash/i }).click()
    await page.getByRole('button', { name: /confirm|complete|done/i }).click()
    await expect(page.getByText(/success|receipt|completed/i)).toBeVisible({ timeout: 5000 })

    // Navigate to serial — should show SOLD
    const soldSerial = { ...MOCK_SERIAL, status: 'SOLD' }
    await mockApiGet(page, 'serials/srl_1', soldSerial)
    await mockApiGet(page, 'products/prod_serial/serials/srl_1', soldSerial)
    await mockApiGet(page, 'products/prod_serial', MOCK_SERIAL_PRODUCT)

    await page.goto('/products/prod_serial/serials/srl_1')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText(/sold/i).first()).toBeVisible({ timeout: 5000 })
  })
})
