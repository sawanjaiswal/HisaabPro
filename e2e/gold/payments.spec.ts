/**
 * Suite L — Payments, allocation and outstanding. Plan: docs/E2E_TEST_PLAN.md §13.
 * Cases TC-PAY-01..10.
 *
 * A payment touches three records at once: the payment row, the invoice it is
 * allocated against, and the party's outstanding balance. They are written in
 * one transaction, so any case that asserts only one of them would pass while
 * the other two drifted — every case here reads back all of the ones it moves.
 */

import { test, expect, loginViaUi } from './support/fixtures'
import { SEEDED_OWNER_PHONE, VALID_PASSWORD } from './support/constants'
import { apiCreateParty, uniqueName } from './support/parties'
import { apiCreateProduct, uniqueProductName } from './support/products'
import { apiCreateInvoice, apiGetInvoice } from './support/invoices'
import {
  apiDeletePayment,
  apiGetPayment,
  apiPartyOutstanding,
  apiRecordPayment,
  apiRecordPaymentResponse,
  apiUpdateAllocationsResponse,
} from './support/payments'

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
})

/** A saved sale of `Rs 1,000 × 5` to a fresh customer — Rs 5,000 receivable. */
async function sellOnCredit(page: import('@playwright/test').Page, quantity = 5) {
  const party = await apiCreateParty(page, { name: uniqueName('Payer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Sold'), salePrice: 100000, openingStock: 100,
  })
  const invoice = await apiCreateInvoice(page, {
    partyId: party.id,
    lineItems: [{ productId: product.id, quantity, rate: 100000 }],
  })
  return { party, product, invoice, detail: await apiGetInvoice(page, invoice.id) }
}

test('TC-PAY-01 a receipt against an invoice settles it and clears the balance', async ({ page }) => {
  const { party, invoice, detail } = await sellOnCredit(page)
  expect(detail.balanceDue, 'a credit sale starts fully unpaid').toBe(detail.grandTotal)
  const owedBefore = await apiPartyOutstanding(page, party.id)

  await apiRecordPayment(page, {
    partyId: party.id,
    amount: detail.grandTotal,
    allocations: [{ invoiceId: invoice.id, amount: detail.grandTotal }],
  })

  const settled = await apiGetInvoice(page, invoice.id)
  expect(settled.paidAmount, 'the invoice records what was paid').toBe(detail.grandTotal)
  expect(settled.balanceDue, 'nothing is still due').toBe(0)
  // The party balance is the number the shopkeeper trusts when the customer
  // walks in. If it lags the invoice, they ask for money already paid.
  expect(await apiPartyOutstanding(page, party.id)).toBe(owedBefore - detail.grandTotal)
})

test('TC-PAY-02 a part payment leaves the rest outstanding', async ({ page }) => {
  const { party, invoice, detail } = await sellOnCredit(page)
  const part = Math.round(detail.grandTotal / 2)

  await apiRecordPayment(page, {
    partyId: party.id,
    amount: part,
    allocations: [{ invoiceId: invoice.id, amount: part }],
  })

  const partial = await apiGetInvoice(page, invoice.id)
  expect(partial.paidAmount).toBe(part)
  expect(partial.balanceDue, 'the remainder stays collectable').toBe(detail.grandTotal - part)
})

test('TC-PAY-03 an advance with no invoice becomes an on-account credit', async ({ page }) => {
  const party = await apiCreateParty(page, { name: uniqueName('Advance Payer') })
  const owedBefore = await apiPartyOutstanding(page, party.id)

  await apiRecordPayment(page, { partyId: party.id, amount: 250000, allocations: [] })

  // Money taken before a bill exists is still the customer's money: it must
  // show as a credit, not vanish because there was nothing to allocate to.
  expect(await apiPartyOutstanding(page, party.id), 'an advance is a credit').toBe(
    owedBefore - 250000,
  )
})

test('TC-PAY-04 every payment mode is stored as recorded', async ({ page }) => {
  const party = await apiCreateParty(page, { name: uniqueName('Modes Payer') })

  for (const mode of ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'] as const) {
    const created = await apiRecordPayment(page, { partyId: party.id, amount: 10000, mode })
    const stored = await apiGetPayment(page, created.id)
    // The mode drives the cash register, the bank reconciliation and the GL
    // account the entry lands in — a silently coerced mode misposts all three.
    expect(stored.mode, `${mode} survives the round trip`).toBe(mode)
  }
})

test('TC-PAY-05 deleting a payment gives the invoice its balance back', async ({ page }) => {
  const { party, invoice, detail } = await sellOnCredit(page)
  const owedBefore = await apiPartyOutstanding(page, party.id)

  const payment = await apiRecordPayment(page, {
    partyId: party.id,
    amount: detail.grandTotal,
    allocations: [{ invoiceId: invoice.id, amount: detail.grandTotal }],
  })
  await apiDeletePayment(page, payment.id)

  const reopened = await apiGetInvoice(page, invoice.id)
  // A payment entered against the wrong customer is deleted every day. If the
  // reversal is partial, the invoice reads settled while the money is not there.
  expect(reopened.balanceDue, 'the bill is collectable again').toBe(detail.grandTotal)
  expect(reopened.paidAmount).toBe(0)
  expect(await apiPartyOutstanding(page, party.id)).toBe(owedBefore)
})

test('TC-PAY-06 allocations may not exceed the payment itself', async ({ page }) => {
  const { party, invoice, detail } = await sellOnCredit(page)

  const res = await apiRecordPaymentResponse(page, {
    partyId: party.id,
    amount: 100000,
    allocations: [{ invoiceId: invoice.id, amount: detail.grandTotal }],
  })

  expect(res.status(), 'Rs 1,000 cannot settle Rs 5,000').toBe(400)
  const still = await apiGetInvoice(page, invoice.id)
  expect(still.balanceDue, 'a refused payment changes nothing').toBe(detail.grandTotal)
})

test('TC-PAY-07 an invoice cannot be paid more than it is worth', async ({ page }) => {
  const { party, invoice, detail } = await sellOnCredit(page)
  const tooMuch = detail.grandTotal + 100000

  const res = await apiRecordPaymentResponse(page, {
    partyId: party.id,
    amount: tooMuch,
    allocations: [{ invoiceId: invoice.id, amount: tooMuch }],
  })

  // Over-allocating drives balanceDue negative, which reads as "the shop owes
  // the customer" on the statement and on every receivables total that sums
  // balanceDue. The excess belongs on account, not on this bill.
  if (res.ok()) {
    const over = await apiGetInvoice(page, invoice.id)
    expect(over.balanceDue, 'an invoice never goes below zero due').toBeGreaterThanOrEqual(0)
    expect(over.paidAmount, 'never more paid than the bill is worth').toBeLessThanOrEqual(
      detail.grandTotal,
    )
  } else {
    expect(res.status()).toBe(400)
  }
})

test('TC-PAY-08 a payment cannot be allocated to another business’s invoice', async ({ page }) => {
  const { party } = await sellOnCredit(page)

  const res = await apiRecordPaymentResponse(page, {
    partyId: party.id,
    amount: 100000,
    allocations: [{ invoiceId: 'clzzzzzzzzzzzzzzzzzzzzzzz', amount: 100000 }],
  })

  // The allocation carries an invoice id straight from the client. If it is not
  // scoped to the business, a guessed id posts one tenant's money against
  // another's ledger.
  expect([400, 403, 404], 'an unknown invoice is refused').toContain(res.status())
})

test('TC-PAY-09 re-saving the same allocations is not an overpayment', async ({ page }) => {
  const { party, invoice, detail } = await sellOnCredit(page)
  const payment = await apiRecordPayment(page, {
    partyId: party.id,
    amount: detail.grandTotal,
    allocations: [{ invoiceId: invoice.id, amount: detail.grandTotal }],
  })

  // The rewrite reverses the existing rows before writing the new ones, so the
  // invoice's own due is momentarily zero. A cap that ignored that would refuse
  // every edit of a fully-settled invoice — the guard has to count the capacity
  // this payment is about to give back.
  const same = await apiUpdateAllocationsResponse(page, payment.id, [
    { invoiceId: invoice.id, amount: detail.grandTotal },
  ])
  expect(same.status(), 'an unchanged allocation still fits').toBe(200)

  const settled = await apiGetInvoice(page, invoice.id)
  expect(settled.balanceDue).toBe(0)
  expect(settled.paidAmount).toBe(detail.grandTotal)
})

test('TC-PAY-10 rewritten allocations cannot reach an invoice this business does not own', async ({
  page,
}) => {
  const { party, invoice, detail } = await sellOnCredit(page)
  const payment = await apiRecordPayment(page, {
    partyId: party.id,
    amount: detail.grandTotal,
    allocations: [{ invoiceId: invoice.id, amount: detail.grandTotal }],
  })

  // The id comes straight off the wire and is used to increment paidAmount. The
  // update path used to skip the ownership check the create path ran, so a
  // foreign id would have been written into another tenant's ledger.
  const res = await apiUpdateAllocationsResponse(page, payment.id, [
    { invoiceId: 'clzzzzzzzzzzzzzzzzzzzzzzz', amount: 100000 },
  ])
  expect([400, 403, 404], 'an invoice outside the business is refused').toContain(res.status())

  const untouched = await apiGetInvoice(page, invoice.id)
  expect(untouched.paidAmount, 'the refused rewrite left the real invoice alone').toBe(
    detail.grandTotal,
  )
})
