/**
 * Suite S — Purchases, part 1. Plan: docs/E2E_TEST_PLAN.md §16.
 * Cases TC-PUR-01..05. TC-PUR-06..08 (returns, cost basis, valuation) live in
 * purchase-costing.spec.ts.
 *
 * The purchase side is where a shop's money goes out, and every number it moves
 * has the opposite sign to the sale side that the rest of the suite exercises:
 * stock increases, the party balance goes negative because the shop owes the
 * supplier, and the tax is credit rather than liability. A sign that flips in
 * only one of those places is invisible on screen and shows up a quarter later
 * as a payable that never clears — so every case here asserts the server's
 * stored columns, not the page.
 */

import { test, expect, loginViaUi } from './support/fixtures'
import { SEEDED_OWNER_PHONE, VALID_PASSWORD } from './support/constants'
import { apiCreateParty, uniqueName } from './support/parties'
import { apiCreateProduct, apiProductStock, uniqueProductName } from './support/products'
import { apiCreateInvoice, apiGetInvoice } from './support/invoices'
import { apiUpdateInvoice, apiDeleteInvoice } from './support/invoice-mutations'
import { apiRecordPayment } from './support/payments'
import { csrfRequest } from './support/fixtures'
import { apiCreatePurchase, apiPartyBalance, API, today } from './support/purchases'
import { enableGst, disableGst, taxCategoryAt } from './support/gst'
import { apiExportGstr3b, periodOf, headsOf } from './support/gst-reports'

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
})

/** A supplier and a product that starts with nothing on the shelf. */
async function arrangeSupplierAndProduct(page: Parameters<typeof apiCreateParty>[0], extra: Record<string, unknown> = {}) {
  const supplier = await apiCreateParty(page, {
    name: uniqueName('E2E Supplier'),
    type: 'SUPPLIER',
  })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Bought'),
    salePrice: 55000,
    openingStock: 0,
    ...extra,
  })
  return { supplier, product }
}

test('TC-PUR-01 a supplier bill puts the goods on the shelf and the money on the payable', async ({ page }) => {
  const { supplier, product } = await arrangeSupplierAndProduct(page)
  const before = await apiPartyBalance(page, supplier.id)

  const bill = await apiCreatePurchase(page, {
    partyId: supplier.id,
    lineItems: [{ productId: product.id, quantity: 10, rate: 42000 }],
  })

  const stored = await apiGetInvoice(page, bill.id)
  expect(stored.grandTotal, 'ten units at Rs 420 each').toBe(420000)
  expect(stored.documentNumber, 'purchases get their own numbering series').toMatch(/^PI/i)

  expect(await apiProductStock(page, product.id), 'buying stock increases stock').toBe(10)

  // Negative = the shop owes the supplier. A purchase that moved this the same
  // way a sale does would show the supplier as a debtor and inflate receivables
  // by the value of every bill the shop has ever received.
  const after = await apiPartyBalance(page, supplier.id)
  expect(after - before, 'the bill is a payable, not a receivable').toBe(-420000)
})

test('TC-PUR-02 a taxed purchase becomes input credit on the return', async ({ page }) => {
  await enableGst(page)
  try {
    const gst18 = await taxCategoryAt(page, 1800)
    const { supplier, product } = await arrangeSupplierAndProduct(page, { taxCategoryId: gst18.id })

    const period = periodOf(today())
    const before = await apiExportGstr3b(page, period)
    const itcBefore = headsOf(before.summary.sections.find((s) => s.section === '4') ?? {})

    const bill = await apiCreatePurchase(page, {
      partyId: supplier.id,
      lineItems: [{ productId: product.id, quantity: 10, rate: 100000, taxCategoryId: gst18.id }],
    })

    const stored = await apiGetInvoice(page, bill.id)
    const tax = (stored.totalCgst ?? 0) + (stored.totalSgst ?? 0) + (stored.totalIgst ?? 0)
    expect(tax, '18% of Rs 10,000').toBe(180000)

    // ITC is money the shop gets back. A purchase the return does not see is a
    // credit the shop paid for and cannot claim.
    // The export is the NIC boundary, so its figures are RUPEES — the portal
    // will not accept paise. Documents stay in paise; only this hop converts.
    const after = await apiExportGstr3b(page, period)
    const itcAfter = headsOf(after.summary.sections.find((s) => s.section === '4') ?? {})
    expect(itcAfter - itcBefore, 'the bill lands in section 4, ITC available').toBe(180000 / 100)
  } finally {
    await disableGst(page).catch(() => {})
  }
})

test('TC-PUR-03 editing a bill re-reconciles both the shelf and the payable', async ({ page }) => {
  const { supplier, product } = await arrangeSupplierAndProduct(page)
  const before = await apiPartyBalance(page, supplier.id)

  const bill = await apiCreatePurchase(page, {
    partyId: supplier.id,
    lineItems: [{ productId: product.id, quantity: 10, rate: 42000 }],
  })
  expect(await apiProductStock(page, product.id)).toBe(10)

  // The supplier delivered four, not ten — the bill is corrected, not re-entered.
  await apiUpdateInvoice(page, bill.id, {
    partyId: supplier.id,
    documentDate: today(),
    lineItems: [{ productId: product.id, quantity: 4, rate: 42000 }],
  })

  const stored = await apiGetInvoice(page, bill.id)
  expect(stored.grandTotal).toBe(168000)
  // Re-reconcile means the OLD effect is undone and the new one applied, not
  // that the new one is added on top: 10 then 4 must leave 4, never 14.
  expect(await apiProductStock(page, product.id), 'the edit replaces the old stock move').toBe(4)
  expect(await apiPartyBalance(page, supplier.id) - before, 'and the old payable').toBe(-168000)
})

test('TC-PUR-04 deleting a bill reverses everything it did', async ({ page }) => {
  const { supplier, product } = await arrangeSupplierAndProduct(page)
  const before = await apiPartyBalance(page, supplier.id)

  const bill = await apiCreatePurchase(page, {
    partyId: supplier.id,
    lineItems: [{ productId: product.id, quantity: 10, rate: 42000 }],
  })
  await apiDeleteInvoice(page, bill.id)

  expect(await apiProductStock(page, product.id), 'goods never received').toBe(0)
  expect(await apiPartyBalance(page, supplier.id), 'nothing owed').toBe(before)
})

test('TC-PUR-04b a bill whose stock has already been sold cannot be deleted into negative stock', async ({ page }) => {
  const { supplier, product } = await arrangeSupplierAndProduct(page)
  const customer = await apiCreateParty(page, { name: uniqueName('Buyer') })

  await apiCreatePurchase(page, {
    partyId: supplier.id,
    lineItems: [{ productId: product.id, quantity: 10, rate: 42000 }],
  })
  const bill2 = await apiCreatePurchase(page, {
    partyId: supplier.id,
    lineItems: [{ productId: product.id, quantity: 10, rate: 42000 }],
  })
  await apiCreateInvoice(page, {
    partyId: customer.id,
    lineItems: [{ productId: product.id, quantity: 15, rate: 55000 }],
  })
  expect(await apiProductStock(page, product.id), 'twenty in, fifteen out').toBe(5)

  // Reversing the second bill would take ten units back off a shelf that only
  // has five: the goods are with the customer. Whatever the server decides, it
  // must not end with stock the shop cannot have.
  const res = await csrfRequest(page, 'delete', `${API}/documents/${bill2.id}`)
  const stock = await apiProductStock(page, product.id)
  expect(stock, 'a delete must not leave the shelf owing goods').toBeGreaterThanOrEqual(0)
  if (res.ok()) {
    expect(stock, 'if the delete is allowed, the reversal is still bounded').toBe(0)
  }
})

test('TC-PUR-05 paying a supplier reduces what the shop owes', async ({ page }) => {
  const { supplier, product } = await arrangeSupplierAndProduct(page)
  const before = await apiPartyBalance(page, supplier.id)

  const bill = await apiCreatePurchase(page, {
    partyId: supplier.id,
    lineItems: [{ productId: product.id, quantity: 10, rate: 42000 }],
  })
  expect(await apiPartyBalance(page, supplier.id) - before).toBe(-420000)

  await apiRecordPayment(page, {
    partyId: supplier.id,
    amount: 200000,
    type: 'PAYMENT_OUT',
    allocations: [{ invoiceId: bill.id, amount: 200000 }],
  })

  // Part-paid, so the payable shrinks rather than clears — and the bill itself
  // has to carry the settlement, otherwise the supplier's next statement asks
  // for the whole amount again.
  expect(await apiPartyBalance(page, supplier.id) - before, 'Rs 2,200 still owed').toBe(-220000)
  const stored = await apiGetInvoice(page, bill.id)
  expect(stored.paidAmount, 'the bill records what was paid').toBe(200000)
  expect(stored.balanceDue, 'and what is left').toBe(220000)
})
