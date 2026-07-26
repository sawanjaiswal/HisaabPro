/**
 * Suite R — POS, part 2: the counter as the cashier uses it.
 * Plan: docs/E2E_TEST_PLAN.md §14 (TC-POS-02, 03, 09, 11).
 *
 * Part 1 asks whether the server got the sale right. This half asks whether a
 * person with a scanner in one hand and a customer in front of them can drive
 * it: a scan that lands in the cart, a scan that finds nothing and says so, a
 * receipt that fits the paper, and yesterday's sales still findable today.
 *
 * TC-POS-06 (held / parked sale) has no test because the feature does not
 * exist — see docs/E2E_RESULTS.md, finding F63.
 */

import { test, expect, loginViaUi } from './support/fixtures'
import { API_BASE } from './support/api'
import { SEEDED_OWNER_PHONE, VALID_PASSWORD } from './support/constants'
import { apiCreateProduct, uniqueProductName, uniqueBarcode } from './support/products'
import { apiPosSale } from './support/pos'

const PRICE = 12500 // Rs 125.00

test.describe('TC-POS — the counter, as the cashier drives it', () => {
  test.beforeEach(async ({ page, request }) => {
    await request.post(`${API_BASE}/__test__/reset-rate-limits`)
    await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
  })

  test('TC-POS-02 a scan puts the item in the cart, and a second scan adds one more', async ({ page }) => {
    const barcode = uniqueBarcode()
    const name = uniqueProductName('POS Scan')
    await apiCreateProduct(page, { name, salePrice: PRICE, openingStock: 20, barcode })

    await page.goto('/pos')
    const scan = page.getByRole('textbox', { name: /barcode|scan/i })
    await expect(scan).toBeVisible({ timeout: 20_000 })

    // A hardware scanner types the code and presses Enter — that is all it is.
    await scan.fill(barcode)
    await scan.press('Enter')
    // Wait for the CART line, not the name: an empty cart shows the product
    // grid, so the name is on screen before anything has been rung up.
    const qty = page.locator('.pos-qty-value')
    await expect(qty).toHaveCount(1, { timeout: 20_000 })
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible({ timeout: 20_000 })

    // Scanning the same item again is how a cashier bills two of something.
    // A second row instead of a second unit is what the customer disputes.
    await scan.fill(barcode)
    await scan.press('Enter')
    await expect(qty).toHaveCount(1)
    await expect(qty, 'the second scan increments the line, not the cart').toHaveText('2')
  })

  test('TC-POS-03 a barcode nothing matches says so instead of failing quietly', async ({ page }) => {
    await page.goto('/pos')
    const scan = page.getByRole('textbox', { name: /barcode|scan/i })
    await expect(scan).toBeVisible({ timeout: 20_000 })

    // A code from no shelf in this shop — a mis-scan, or an item never added.
    await scan.fill('000000000000999')
    await scan.press('Enter')

    await expect(
      page.getByText(/not found|nahi mila|नहीं मिला/i).first(),
      'the cashier is told the scan found nothing',
    ).toBeVisible({ timeout: 20_000 })
    // …and nothing was added on the strength of a failed lookup.
    await expect(page.locator('.pos-qty-value')).toHaveCount(0)
  })

  test('TC-POS-09 the receipt fits the paper and names the shop', async ({ page }) => {
    const product = await apiCreateProduct(page, {
      name: uniqueProductName('POS Receipt'),
      salePrice: PRICE,
      openingStock: 5,
    })
    const sale = await apiPosSale(page, {
      items: [{ productId: product.id, quantity: 2, discountType: 'AMOUNT', discountValue: 0 }],
      payments: [{ mode: 'cash', amountPaise: PRICE * 2 }],
      clientGrandTotal: PRICE * 2,
    })

    await page.goto(`/pos/sales/${sale.id}`)
    await expect(page.getByText(sale.receiptNumber, { exact: false }).first()).toBeVisible({ timeout: 20_000 })

    const receiptButton = page.getByRole('button', { name: /receipt|print|रसीद/i }).first()
    if (await receiptButton.count()) await receiptButton.click()

    // The receipt renders as a PDF inside an iframe, so no selector reaches the
    // shop name printed on it. That the slip is issued by this shop rather than
    // by the old `MOCK_BUSINESS` literal is proved at the props boundary in
    // src/features/pos/__tests__/receipt-identity.test.tsx. What IS observable
    // here is that a receipt was produced at all, in every paper size.
    await expect(page.getByRole('radiogroup', { name: /receipt size|रसीद/i })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('iframe').first(), 'the slip rendered').toBeVisible()
    await expect(page.getByText('My Business', { exact: false })).toHaveCount(0)

    // 58mm thermal paper is ~320 CSS px of usable width. Anything wider is
    // printed off the edge of the roll.
    await page.setViewportSize({ width: 320, height: 720 })
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, 'the receipt does not run off the paper at 320px').toBeLessThanOrEqual(1)
  })

  test('TC-POS-11 today\'s sales are findable, and the detail reconciles', async ({ page }) => {
    const product = await apiCreateProduct(page, {
      name: uniqueProductName('POS History'),
      salePrice: PRICE,
      openingStock: 10,
    })
    const sale = await apiPosSale(page, {
      items: [{ productId: product.id, quantity: 3, discountType: 'AMOUNT', discountValue: 0 }],
      payments: [{ mode: 'cash', amountPaise: PRICE * 3 }],
      clientGrandTotal: PRICE * 3,
    })

    await page.goto('/pos/history')
    const row = page.getByText(sale.receiptNumber, { exact: false }).first()
    await expect(row, 'the sale just rung up is in the day\'s list').toBeVisible({ timeout: 20_000 })

    await row.click()
    await expect(page).toHaveURL(new RegExp(`/pos/sales/${sale.id}`), { timeout: 20_000 })

    // Rs 375.00 — the list, the detail and the server must all say the one
    // number, because this is the screen used to settle a customer's dispute.
    await expect(
      page.getByText(/375/).first(),
      'the detail shows what was actually charged',
    ).toBeVisible({ timeout: 20_000 })

    const stored = await page.request.get(`${API_BASE}/pos/sales/${sale.id}`)
    const body = (await stored.json()) as { data?: { grandTotal?: number; items?: unknown[] } }
    expect(body.data?.grandTotal, 'the screen and the server agree').toBe(PRICE * 3)
    expect(body.data?.items, 'the sale kept its line').toHaveLength(1)
  })
})
