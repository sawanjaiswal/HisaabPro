/**
 * Suite J — Invoices, part 2: draft, edit, delete, payment, and the side
 * effects each one is supposed to have on the rest of the books.
 * Plan: docs/E2E_TEST_PLAN.md §11. Cases TC-INV-05..08 and TC-PRD-08.
 *
 * Part 1 asserts what the document says. This file asserts what the document
 * *did*: stock moved, the ledger gained or lost a row, the balance settled.
 * Those are the parts that fail silently — an invoice that saves correctly and
 * never touches stock looks perfectly fine until the shop counts its shelves.
 */

import { test, expect } from './support/fixtures'
import { loginViaUi } from './support/fixtures'
import { SEEDED_OWNER_PHONE, VALID_PASSWORD } from './support/constants'
import { apiCreateParty, uniqueName } from './support/parties'
import { apiCreateProduct, apiProductStock, uniqueProductName } from './support/products'
import { apiCreateInvoice, apiGetInvoice, apiListInvoices } from './support/invoices'
import {
  apiCreatePayment,
  apiDeleteInvoice,
  apiPartyLedger,
  apiRecycleBinIds,
  apiUpdateInvoice,
  settlement,
} from './support/invoice-mutations'

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
})

test('TC-INV-05 a draft holds its numbers but moves neither stock nor the ledger', async ({
  page,
}) => {
  const party = await apiCreateParty(page, { name: uniqueName('Draft Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Drafted'),
    salePrice: 15000,
    openingStock: 40,
  })
  const stockBefore = await apiProductStock(page, product.id)

  const draft = await apiCreateInvoice(page, {
    partyId: party.id,
    status: 'DRAFT',
    lineItems: [{ productId: product.id, quantity: 6, rate: 15000 }],
  })

  const detail = await apiGetInvoice(page, draft.id)
  expect(detail.status, 'a draft must stay a draft until it is saved').toBe('DRAFT')
  expect(detail.grandTotal, '6 x Rs 150 = Rs 900 — a draft still computes').toBe(90000)

  // A draft is a quotation the seller has not committed to. Reserving stock or
  // debiting the customer for one would mean an abandoned draft quietly owes
  // money and hides goods that are still on the shelf.
  expect(await apiProductStock(page, product.id), 'a draft must not consume stock').toBe(stockBefore)
  const ledger = await apiPartyLedger(page, party.id)
  expect(
    ledger.some((r) => r.voucherNumber === detail.documentNumber),
    'a draft must not appear on the customer statement',
  ).toBe(false)
})

test('TC-PRD-08 saving an invoice takes the sold quantity out of stock', async ({ page }) => {
  const party = await apiCreateParty(page, { name: uniqueName('Stock Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Stocked'),
    salePrice: 12000,
    openingStock: 30,
  })
  const before = await apiProductStock(page, product.id)

  await apiCreateInvoice(page, {
    partyId: party.id,
    lineItems: [{ productId: product.id, quantity: 7, rate: 12000 }],
  })

  // Stock read back from the server, not from a UI badge: the badge can be
  // right while the column is wrong, and it is the column that the reorder
  // alerts, the stock report and the next invoice's availability check read.
  expect(await apiProductStock(page, product.id), 'selling 7 must drop stock by 7').toBe(before - 7)
})

test('TC-INV-06 editing an invoice re-reconciles the total, the stock and the ledger', async ({
  page,
}) => {
  const party = await apiCreateParty(page, { name: uniqueName('Edited Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Edited'),
    salePrice: 20000,
    openingStock: 60,
  })
  const opening = await apiProductStock(page, product.id)

  const invoice = await apiCreateInvoice(page, {
    partyId: party.id,
    lineItems: [{ productId: product.id, quantity: 5, rate: 20000 }],
  })
  expect(await apiProductStock(page, product.id)).toBe(opening - 5)

  // Cut the quantity: an edit that recomputes the total but leaves the old
  // stock deduction in place makes 3 units disappear from the shelf count with
  // nothing on paper explaining where they went.
  await apiUpdateInvoice(page, invoice.id, {
    lineItems: [{ productId: product.id, quantity: 2, rate: 20000 }],
  })

  const after = await apiGetInvoice(page, invoice.id)
  expect(after.grandTotal, '2 x Rs 200 = Rs 400').toBe(40000)
  expect(after.subtotal).toBe(40000)
  expect(await apiProductStock(page, product.id), 'the extra 3 units must come back').toBe(
    opening - 2,
  )

  const ledger = await apiPartyLedger(page, party.id)
  const row = ledger.find((r) => r.voucherNumber === after.documentNumber)
  expect(row, 'the invoice must still be on the statement after an edit').toBeTruthy()
  expect(
    row!.dr,
    'the statement must carry the edited amount, not the amount first invoiced',
  ).toBe(40000)
})

test('TC-INV-07 deleting an invoice reverses the stock and clears the statement', async ({
  page,
}) => {
  const party = await apiCreateParty(page, { name: uniqueName('Deleted Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Deleted'),
    salePrice: 25000,
    openingStock: 20,
  })
  const opening = await apiProductStock(page, product.id)

  const invoice = await apiCreateInvoice(page, {
    partyId: party.id,
    lineItems: [{ productId: product.id, quantity: 4, rate: 25000 }],
  })
  const detail = await apiGetInvoice(page, invoice.id)
  expect(await apiProductStock(page, product.id)).toBe(opening - 4)

  await apiDeleteInvoice(page, invoice.id)

  expect(await apiProductStock(page, product.id), 'a cancelled sale returns its goods').toBe(opening)

  const ledger = await apiPartyLedger(page, party.id)
  expect(
    ledger.some((r) => r.voucherNumber === detail.documentNumber),
    'a deleted invoice must stop billing the customer',
  ).toBe(false)

  const listed = await apiListInvoices(page, `type=SALE_INVOICE&partyId=${party.id}&limit=10`)
  expect(listed.map((d) => d.id), 'a deleted invoice must leave the list').not.toContain(invoice.id)

  // Soft delete, not destruction: an invoice deleted by mistake has to be
  // recoverable, and a numbered document that simply evaporates leaves a hole
  // in the statutory series with no record of why.
  expect(await apiRecycleBinIds(page), 'the invoice must be recoverable').toContain(invoice.id)
})

test('TC-INV-08 a part payment leaves a balance, and the balance settles to zero', async ({
  page,
}) => {
  const party = await apiCreateParty(page, { name: uniqueName('Paying Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Paid'),
    salePrice: 50000,
    openingStock: 20,
  })

  const invoice = await apiCreateInvoice(page, {
    partyId: party.id,
    lineItems: [{ productId: product.id, quantity: 2, rate: 50000 }],
  })
  const issued = await apiGetInvoice(page, invoice.id)
  expect(issued.grandTotal, 'Rs 1,000 invoiced').toBe(100000)
  expect(settlement(issued).due, 'a fresh credit sale owes the whole amount').toBe(100000)

  // Part payment — the common case in an Indian shop, and the one where a
  // naive implementation marks the whole invoice PAID on any receipt.
  await apiCreatePayment(page, {
    partyId: party.id,
    amount: 40000,
    allocations: [{ invoiceId: invoice.id, amount: 40000 }],
  })

  const partly = await apiGetInvoice(page, invoice.id)
  expect(settlement(partly).paid, 'Rs 400 received').toBe(40000)
  expect(settlement(partly).due, 'Rs 600 still owed').toBe(60000)
  expect(partly.status, 'a part-paid invoice is not settled').not.toBe('PAID')

  await apiCreatePayment(page, {
    partyId: party.id,
    amount: 60000,
    allocations: [{ invoiceId: invoice.id, amount: 60000 }],
  })

  const settled = await apiGetInvoice(page, invoice.id)
  expect(settlement(settled).paid).toBe(100000)
  expect(settlement(settled).due, 'the invoice must settle to exactly zero').toBe(0)

  // The statement is what the customer is shown when they dispute a balance:
  // the invoice debit and both receipts have to be on it, and they have to net
  // out — a paid invoice that still reads as outstanding is a lost customer.
  const ledger = await apiPartyLedger(page, party.id)
  const rows = ledger.filter((r) => r.dr > 0 || r.cr > 0)
  const net = rows.reduce((sum, r) => sum + r.dr - r.cr, 0)
  expect(net, 'invoiced Rs 1,000 less receipts of Rs 1,000 is nil').toBe(0)
})
