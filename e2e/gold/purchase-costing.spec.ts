/**
 * Suite S — Purchases, part 2. Plan: docs/E2E_TEST_PLAN.md §16.
 * Cases TC-PUR-06..08: the return, the cost basis, and the valuation.
 *
 * These three are the ones a shop discovers late. A purchase return that does
 * not take the goods back off the shelf leaves inventory permanently long; a
 * cost basis that never moves prices every future margin off the first bill
 * ever entered; and a valuation built on either of those is the number that
 * goes on the balance sheet. All three read the server, never the screen.
 */

import { test, expect, loginViaUi } from './support/fixtures'
import { SEEDED_OWNER_PHONE, VALID_PASSWORD } from './support/constants'
import { apiCreateParty, uniqueName } from './support/parties'
import { apiCreateProduct, apiProductStock, uniqueProductName } from './support/products'
import { apiCreateInvoice, apiGetInvoice } from './support/invoices'
import {
  apiCreatePurchase,
  apiCreateDebitNote,
  apiCreateCreditNote,
  apiPartyBalance,
  apiStockValueRow,
  today,
} from './support/purchases'
import { enableGst, disableGst, taxCategoryAt } from './support/gst'
import { apiExportGstr3b, periodOf, headsOf } from './support/gst-reports'

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
})

test('TC-PUR-06 returning goods to a supplier takes them back off the shelf and off the credit', async ({ page }) => {
  await enableGst(page)
  try {
    const gst18 = await taxCategoryAt(page, 1800)
    const supplier = await apiCreateParty(page, { name: uniqueName('E2E Supplier'), type: 'SUPPLIER' })
    const product = await apiCreateProduct(page, {
      name: uniqueProductName('Returned'),
      salePrice: 150000,
      openingStock: 0,
      taxCategoryId: gst18.id,
    })

    const bill = await apiCreatePurchase(page, {
      partyId: supplier.id,
      lineItems: [{ productId: product.id, quantity: 10, rate: 100000, taxCategoryId: gst18.id }],
    })
    expect(await apiProductStock(page, product.id)).toBe(10)
    const afterBill = await apiPartyBalance(page, supplier.id)

    const period = periodOf(today())
    const beforeReturn = await apiExportGstr3b(page, period)
    const itcBefore = headsOf(beforeReturn.summary.sections.find((s) => s.section === '4') ?? {})
    const reversedBefore = headsOf(beforeReturn.summary.sections.find((s) => s.section === '4(D)') ?? {})

    // Three were damaged and went back to the supplier.
    const note = await apiCreateDebitNote(page, {
      partyId: supplier.id,
      originalDocumentId: bill.id,
      lineItems: [{ productId: product.id, quantity: 3, rate: 100000, taxCategoryId: gst18.id }],
    })

    const stored = await apiGetInvoice(page, note.id)
    expect(stored.documentNumber, 'a purchase return is a debit note').toMatch(/^DN/i)
    expect(stored.grandTotal, 'three units plus their tax').toBe(354000)

    // The goods are physically back with the supplier. Stock that stays at ten
    // is stock the shop will try to sell twice.
    expect(await apiProductStock(page, product.id), 'returned goods leave the shelf').toBe(7)

    // The shop owes the supplier less by exactly the note.
    expect(await apiPartyBalance(page, supplier.id) - afterBill, 'the payable shrinks').toBe(354000)

    // And the input credit claimed on those three has to go back too — claiming
    // ITC on goods that were returned is what a department notice is made of.
    const afterReturn = await apiExportGstr3b(page, period)
    const itcAfter = headsOf(afterReturn.summary.sections.find((s) => s.section === '4') ?? {})
    const reversedAfter = headsOf(afterReturn.summary.sections.find((s) => s.section === '4(D)') ?? {})
    const netClaimed = (itcAfter - reversedAfter) - (itcBefore - reversedBefore)
    // Rupees, not paise: the export is the NIC boundary (see TC-PUR-02).
    expect(netClaimed, 'net ITC drops by the tax on the returned three').toBe(-54000 / 100)
  } finally {
    await disableGst(page).catch(() => {})
  }
})

test('TC-PUR-07 what the shop paid becomes what the stock is worth', async ({ page }) => {
  const supplier = await apiCreateParty(page, { name: uniqueName('E2E Supplier'), type: 'SUPPLIER' })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Costed'),
    salePrice: 300000,
    openingStock: 0,
  })

  await apiCreatePurchase(page, {
    partyId: supplier.id,
    lineItems: [{ productId: product.id, quantity: 10, rate: 100000 }],
  })
  const first = await apiStockValueRow(page, product.id)
  expect(first?.unitCostPaise, 'the first bill sets the cost basis').toBe(100000)

  // The supplier raised the price. Weighted average, not last-price: ten at
  // Rs 1,000 and ten at Rs 2,000 is Rs 1,500 a unit, and a shop that priced its
  // margin off Rs 1,000 would sell the second batch at a loss.
  await apiCreatePurchase(page, {
    partyId: supplier.id,
    lineItems: [{ productId: product.id, quantity: 10, rate: 200000 }],
  })

  const second = await apiStockValueRow(page, product.id)
  expect(second?.currentStock, 'twenty on the shelf').toBe(20)
  expect(second?.unitCostPaise, 'the average of what was actually paid').toBe(150000)
})

test('TC-PUR-09 a customer return must not reprice the shelf at the selling price', async ({ page }) => {
  const supplier = await apiCreateParty(page, { name: uniqueName('E2E Supplier'), type: 'SUPPLIER' })
  const customer = await apiCreateParty(page, { name: uniqueName('Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Returned In'),
    salePrice: 300000,
    openingStock: 0,
  })

  await apiCreatePurchase(page, {
    partyId: supplier.id,
    lineItems: [{ productId: product.id, quantity: 10, rate: 100000 }],
  })
  const sale = await apiCreateInvoice(page, {
    partyId: customer.id,
    lineItems: [{ productId: product.id, quantity: 5, rate: 300000 }],
  })

  // The goods come back in through the same helper a purchase uses, carrying
  // the price they were SOLD at. Averaging that into the cost basis would say
  // the shop paid Rs 3,000 for stock it bought at Rs 1,000, and every margin
  // and valuation after it would be computed against a price never paid.
  await apiCreateCreditNote(page, {
    partyId: customer.id,
    originalDocumentId: sale.id,
    lineItems: [{ productId: product.id, quantity: 5, rate: 300000 }],
  })

  const row = await apiStockValueRow(page, product.id)
  expect(row?.currentStock, 'five sold, five returned').toBe(10)
  expect(row?.unitCostPaise, 'still what the supplier charged').toBe(100000)
})

test('TC-PUR-08 the valuation report prices the shelf at what it cost', async ({ page }) => {
  const supplier = await apiCreateParty(page, { name: uniqueName('E2E Supplier'), type: 'SUPPLIER' })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Valued'),
    salePrice: 90000,
    openingStock: 0,
  })

  await apiCreatePurchase(page, {
    partyId: supplier.id,
    lineItems: [{ productId: product.id, quantity: 7, rate: 63000 }],
  })

  const row = await apiStockValueRow(page, product.id)
  expect(row, 'a product with stock appears in the valuation').not.toBeNull()
  expect(row?.currentStock).toBe(7)
  expect(row?.unitCostPaise).toBe(63000)
  // The line is quantity × cost, not the sale price — valuing stock at what it
  // will sell for books the profit before the sale happens.
  expect(row?.totalPaise, 'seven at Rs 630').toBe(441000)
})
