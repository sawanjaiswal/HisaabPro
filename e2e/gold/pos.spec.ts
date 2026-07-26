/**
 * Suite R — POS, part 1: the counter transaction itself.
 * Plan: docs/E2E_TEST_PLAN.md §14 (TC-POS-01, 04, 05, 07, 08, 10, 12).
 *
 * A POS sale is the only document created with a customer waiting, so the
 * questions here are the ones the shopkeeper cannot re-check later: did the
 * stock move, did the tenders add up to what was charged, did a double-tap
 * bill the customer twice, and does the tax match what the same goods would
 * have been taxed at on an invoice.
 */

import { test, expect, loginViaUi } from './support/fixtures'
import { API_BASE } from './support/api'
import { SEEDED_OWNER_PHONE, VALID_PASSWORD, FOREIGN } from './support/constants'
import { apiCreateProduct, uniqueProductName } from './support/products'
import { apiCreateParty, uniqueName } from './support/parties'
import { apiCreateInvoice, apiGetInvoice, today } from './support/invoices'
import { enableGst, disableGst, taxCategoryAt } from './support/gst'
import {
  apiPosSale,
  apiStock,
  posCheckout,
  idempotencyKey,
  setStockPolicy,
} from './support/pos'

const PRICE = 10000 // Rs 100.00 in paise

test.describe('TC-POS — checkout, tenders, stock, tax', () => {
  test.beforeEach(async ({ page, request }) => {
    await request.post(`${API_BASE}/__test__/reset-rate-limits`)
    await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
  })

  test('TC-POS-01 a cash sale is recorded and the stock leaves the shelf (P0)', async ({ page }) => {
    const product = await apiCreateProduct(page, { name: uniqueProductName('POS Cash'), salePrice: PRICE, openingStock: 10 })
    const before = await apiStock(page, product.id)

    const sale = await apiPosSale(page, {
      items: [{ productId: product.id, quantity: 2, discountType: 'AMOUNT', discountValue: 0 }],
      payments: [{ mode: 'cash', amountPaise: PRICE * 2 }],
      clientGrandTotal: PRICE * 2,
    })

    expect(sale.grandTotal, 'the customer is charged for two units').toBe(PRICE * 2)
    expect(sale.status).toBe('ACTIVE')
    expect(sale.receiptNumber, 'the receipt is numbered').toBeTruthy()

    // The shelf is the half a receipt cannot prove: a sale that bills correctly
    // and never decrements leaves the shopkeeper selling stock they don't have.
    expect(await apiStock(page, product.id), 'two units left the shelf').toBe(before - 2)

    // And it is readable back — a sale only in the response is a sale the
    // day's takings will not include.
    const listed = await page.request.get(`${API_BASE}/pos/sales?limit=20`)
    expect(listed.status()).toBe(200)
    expect(await listed.text(), 'the sale appears in POS history').toContain(sale.id)
  })

  test('TC-POS-04 a split payment reconciles to the grand total', async ({ page }) => {
    const product = await apiCreateProduct(page, { name: uniqueProductName('POS Split'), salePrice: PRICE, openingStock: 10 })

    const sale = await apiPosSale(page, {
      items: [{ productId: product.id, quantity: 3, discountType: 'AMOUNT', discountValue: 0 }],
      payments: [
        { mode: 'cash', amountPaise: 10000 },
        { mode: 'upi', amountPaise: 20000, referenceNumber: 'E2E-UPI-001' },
      ],
      clientGrandTotal: PRICE * 3,
    })

    expect(sale.grandTotal).toBe(PRICE * 3)
    const breakdown = JSON.stringify(sale.paymentBreakdown)
    expect(breakdown, 'the cash tender is kept').toContain('cash')
    expect(breakdown, 'the UPI tender is kept').toContain('upi')
    expect(breakdown, 'the UPI reference is kept for the reconciliation').toContain('E2E-UPI-001')

    // Split tenders are where a rounding slip hides: each half is right and the
    // pair is short. Read back from the server, not from the response above.
    const detail = await page.request.get(`${API_BASE}/pos/sales/${sale.id}`)
    const stored = (await detail.json()) as { data?: { grandTotal?: number; paymentBreakdown?: Array<{ amountPaise?: number }> } }
    const tendered = (stored.data?.paymentBreakdown ?? []).reduce((sum, p) => sum + Number(p.amountPaise ?? 0), 0)
    expect(tendered, 'the tenders sum to what was charged').toBe(stored.data?.grandTotal)
  })

  test('TC-POS-05 a line discount comes off before tax is worked out', async ({ page }) => {
    await enableGst(page)
    try {
      const gst18 = await taxCategoryAt(page, 1800)
      const product = await apiCreateProduct(page, {
        name: uniqueProductName('POS Disc'),
        salePrice: PRICE,
        openingStock: 10,
        taxCategoryId: gst18.id,
      })

      // 10% off two units of Rs 100 → Rs 180 taxable, Rs 32.40 of GST.
      const sale = await apiPosSale(page, {
        items: [{ productId: product.id, quantity: 2, discountType: 'PERCENTAGE', discountValue: 1000 }],
        payments: [{ mode: 'cash', amountPaise: 21240 }],
        clientGrandTotal: 21240,
      })

      expect(sale.totalDiscount, 'the discount is recorded, not folded away').toBe(2000)
      expect(sale.totalTaxableValue, 'tax is worked out on the discounted value').toBe(18000)
      expect(sale.totalCgst + sale.totalSgst, 'GST follows the discounted value').toBe(3240)
      expect(sale.grandTotal).toBe(21240)
    } finally {
      await disableGst(page)
    }
  })

  test('TC-POS-07 a walk-in customer needs no party record', async ({ page }) => {
    const product = await apiCreateProduct(page, { name: uniqueProductName('POS Walkin'), salePrice: PRICE, openingStock: 5 })

    const sale = await apiPosSale(page, {
      items: [{ productId: product.id, quantity: 1, discountType: 'AMOUNT', discountValue: 0 }],
      payments: [{ mode: 'cash', amountPaise: PRICE }],
      clientGrandTotal: PRICE,
      walkInName: 'Walk In Customer',
      walkInPhone: '9876512345',
    })

    expect(sale.walkInName, 'the name given at the counter is kept on the sale').toBe('Walk In Customer')

    // Walk-ins post against one sentinel party per business ("Walk-in
    // Customer") rather than each opening a ledger account — so the second
    // walk-in must reuse the first's, not create a second sentinel. A shop
    // doing fifty counter sales a day would otherwise have fifty dead
    // customers in its party list by evening.
    const again = await apiPosSale(page, {
      items: [{ productId: product.id, quantity: 1, discountType: 'AMOUNT', discountValue: 0 }],
      payments: [{ mode: 'cash', amountPaise: PRICE }],
      clientGrandTotal: PRICE,
      walkInName: 'Another Walk In',
    })
    expect(again.partyId, 'both walk-ins share one sentinel party').toBe(sale.partyId)

    // The counter must also still be able to bill a named account — the two
    // paths share one validator, and a refinement that breaks one is invisible
    // until the other is tried.
    const party = await apiCreateParty(page, { name: uniqueName('POS Regular'), type: 'CUSTOMER' })
    const named = await apiPosSale(page, {
      items: [{ productId: product.id, quantity: 1, discountType: 'AMOUNT', discountValue: 0 }],
      payments: [{ mode: 'cash', amountPaise: PRICE }],
      clientGrandTotal: PRICE,
      partyId: party.id,
    })
    expect(named.partyId, 'a named customer is attached to the sale').toBe(party.id)
  })

  test('TC-POS-08 selling past the stock on hand follows the shop\'s own policy', async ({ page }) => {
    const product = await apiCreateProduct(page, { name: uniqueProductName('POS Oversell'), salePrice: PRICE, openingStock: 1 })

    // HARD_BLOCK: the shop has decided it will not sell what it does not have.
    const restore = await setStockPolicy(page, 'HARD_BLOCK')
    try {
      const res = await posCheckout(
        page,
        {
          items: [{ productId: product.id, quantity: 5, discountType: 'AMOUNT', discountValue: 0 }],
          payments: [{ mode: 'cash', amountPaise: PRICE * 5 }],
          clientGrandTotal: PRICE * 5,
        },
        idempotencyKey(),
      )
      expect(res.status(), `overselling under HARD_BLOCK must be refused, got ${res.status()}`).toBe(400)
      const message = await res.text()
      expect(message, 'the refusal names the problem').toContain('OVERSELL_BLOCKED')
      expect(await apiStock(page, product.id), 'a refused sale moves no stock').toBe(1)
    } finally {
      await restore()
    }

    // WARN_ONLY (the default): the sale goes through — a queue at the counter
    // is a worse failure than a negative number — but it is flagged.
    const sale = await apiPosSale(page, {
      items: [{ productId: product.id, quantity: 5, discountType: 'AMOUNT', discountValue: 0 }],
      payments: [{ mode: 'cash', amountPaise: PRICE * 5 }],
      clientGrandTotal: PRICE * 5,
    })
    expect(sale.warnings.join(' '), 'the oversell is surfaced, not silent').toMatch(/stock|Stock/)
    expect(await apiStock(page, product.id), 'the shortfall is visible as negative stock').toBe(-4)
  })

  test('TC-POS-10 a replayed checkout bills the customer once (P0)', async ({ page }) => {
    const product = await apiCreateProduct(page, { name: uniqueProductName('POS Replay'), salePrice: PRICE, openingStock: 10 })
    const before = await apiStock(page, product.id)
    const key = idempotencyKey()
    const body = {
      items: [{ productId: product.id, quantity: 2, discountType: 'AMOUNT' as const, discountValue: 0 }],
      payments: [{ mode: 'cash' as const, amountPaise: PRICE * 2 }],
      clientGrandTotal: PRICE * 2,
    }

    // The offline queue replays on reconnect, and a flaky counter tablet
    // replays on its own. Same key, same payload, twice.
    const first = await apiPosSale(page, body, key)
    const second = await posCheckout(page, body, key)
    expect(second.status(), `a replay must not be a second sale, got ${second.status()}`).toBeLessThan(300)
    const replayed = (await second.json()) as { data?: { id?: string } }
    expect(replayed.data?.id, 'the replay returns the original sale').toBe(first.id)

    expect(await apiStock(page, product.id), 'the shelf moved once').toBe(before - 2)
    const list = await page.request.get(`${API_BASE}/pos/sales?limit=50`)
    const ids = ((await list.json()) as { data?: { sales?: Array<{ id: string }> } }).data?.sales ?? []
    expect(ids.filter((s) => s.id === first.id).length, 'one sale, not two').toBe(1)
  })

  test('TC-POS-12 the same goods are taxed the same at the counter and on an invoice', async ({ page }) => {
    await enableGst(page)
    try {
      const gst18 = await taxCategoryAt(page, 1800)
      const product = await apiCreateProduct(page, {
        name: uniqueProductName('POS Parity'),
        salePrice: PRICE,
        openingStock: 20,
        taxCategoryId: gst18.id,
        hsnCode: '1006',
      })
      const party = await apiCreateParty(page, { name: uniqueName('POS Parity'), type: 'CUSTOMER' })

      const sale = await apiPosSale(page, {
        items: [{ productId: product.id, quantity: 3, discountType: 'AMOUNT', discountValue: 0 }],
        payments: [{ mode: 'cash', amountPaise: 35400 }],
        clientGrandTotal: 35400,
        partyId: party.id,
      })

      const created = await apiCreateInvoice(page, {
        partyId: party.id,
        documentDate: today(),
        lineItems: [{ productId: product.id, quantity: 3, rate: PRICE, taxCategoryId: gst18.id, hsnCode: '1006' }],
      })
      const invoice = await apiGetInvoice(page, created.id)

      // Two code paths, one tax law. A divergence here is a GSTR-1 that does
      // not agree with the shop's own books.
      expect(sale.totalTaxableValue, 'same taxable value').toBe(invoice.subtotal)
      expect(sale.totalCgst, 'same CGST').toBe(invoice.totalCgst ?? 0)
      expect(sale.totalSgst, 'same SGST').toBe(invoice.totalSgst ?? 0)
      expect(sale.totalIgst, 'same IGST').toBe(invoice.totalIgst ?? 0)
      expect(sale.grandTotal, 'same amount payable').toBe(invoice.grandTotal)
    } finally {
      await disableGst(page)
    }
  })

  test('TC-POS-13 a shop without the POS plan is refused the counter by the server, not just the screen', async ({ page, context }) => {
    // The neighbouring tenant is seeded with no subscription, so it resolves to
    // a plan without `posMode` — exactly the shop the UI shows an upgrade wall
    // to. The wall is advisory; this asks the API the same question.
    await context.clearCookies()
    await loginViaUi(page, FOREIGN.phone, VALID_PASSWORD)

    const res = await posCheckout(
      page,
      {
        items: [{ productId: FOREIGN.productId, quantity: 1, discountType: 'AMOUNT', discountValue: 0 }],
        payments: [{ mode: 'cash', amountPaise: 99900 }],
        clientGrandTotal: 99900,
      },
      idempotencyKey(),
    )

    expect(res.status(), 'the paywall answers before the checkout runs').toBe(402)
    const body = (await res.json()) as { error?: { code?: string } }
    expect(body.error?.code, 'and says why, so the client can offer the upgrade').toBe('UPGRADE_REQUIRED')

    // Nothing was rung up on the strength of a refused call.
    const list = await page.request.get(`${API_BASE}/pos/sales`)
    expect(list.status(), 'reads are gated too — POS is a feature, not an endpoint').toBe(402)
  })
})
