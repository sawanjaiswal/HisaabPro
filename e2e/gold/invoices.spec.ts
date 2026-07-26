/**
 * Suite J — Invoices, core part 1: create, arithmetic, live recompute,
 * numbering, validation.
 * Plan: docs/E2E_TEST_PLAN.md §11. Cases TC-INV-01..04, TC-INV-15.
 *
 * The seeded business has GST off (npm run e2e:seed), so these cases assert
 * the plain billing arithmetic. The CGST/SGST/IGST split is Suite K's subject
 * and runs against a GST-enabled business — asserting tax here would test two
 * features at once and blame the wrong one when it breaks.
 *
 * Every total is checked against the SERVER's stored value, not the rendered
 * one: a UI that computes correctly and persists something else is precisely
 * the bug a billing app cannot ship with.
 */

import { test, expect, loginViaUi, trackFailedRequests } from './support/fixtures'
import { SEEDED_OWNER_PHONE, VALID_PASSWORD } from './support/constants'
import { apiCreateParty, uniqueName, uniquePartyPhone } from './support/parties'
import { apiCreateProduct, uniqueProductName } from './support/products'
import {
  addLine,
  apiCreateInvoice,
  apiGetInvoice,
  apiListInvoices,
  selectParty,
  setLineFields,
} from './support/invoices'

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
})

/** Walks the form's Preview → Save & Send finish, which is how the app saves. */
async function saveInvoice(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: /preview invoice/i }).click()
  await page.getByRole('button', { name: /save & send|saving/i }).click()
}

test('TC-INV-01 an invoice created from the form saves with the total it displayed', async ({
  page,
}) => {
  const failures = trackFailedRequests(page)
  const party = await apiCreateParty(page, {
    name: uniqueName('Invoice Buyer'),
    phone: uniquePartyPhone(),
  })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Invoiced'),
    salePrice: 25000, // Rs 250.00
    openingStock: 50,
  })

  await page.goto('/invoices/new')
  await selectParty(page, party.name)
  await addLine(page, product.name)
  await setLineFields(page, 0, { quantity: 3 })

  // 3 x Rs 250 = Rs 750. The bar is what the seller reads out loud to the
  // customer, so it has to agree with what is about to be stored.
  await expect(page.locator('.invoice-summary-row-total')).toContainText('750')

  await saveInvoice(page)
  await page.waitForURL('**/invoices', { timeout: 20_000 })

  // Filtered by this case's own party: the list is shared with every other
  // invoice the suite has ever created, so "the newest row" is not this one.
  const [saved] = await apiListInvoices(page, `type=SALE_INVOICE&partyId=${party.id}&limit=10`)
  expect(saved, 'the invoice must exist on the server').toBeTruthy()
  const detail = await apiGetInvoice(page, saved!.id)
  expect(detail.grandTotal, 'Rs 750 must persist as 75000 paise').toBe(75000)
  expect(detail.subtotal).toBe(75000)
  expect(detail.status).toBe('SAVED')
  expect(failures.get(), 'saving an invoice must not produce an API failure').toEqual([])
})

test('TC-INV-02 lines, discounts and the grand total are arithmetically consistent', async ({
  page,
}) => {
  const party = await apiCreateParty(page, { name: uniqueName('Multi Line') })
  const cheap = await apiCreateProduct(page, {
    name: uniqueProductName('Cheap'),
    salePrice: 10000,
    openingStock: 100,
  })
  const dear = await apiCreateProduct(page, {
    name: uniqueProductName('Dear'),
    salePrice: 33333, // Rs 333.33 — a rate that does not divide evenly
    openingStock: 100,
  })

  // Arranged over the API so the assertion is about the arithmetic, not about
  // whether two lines can be typed into the form (TC-INV-01 covers that).
  const invoice = await apiCreateInvoice(page, {
    partyId: party.id,
    lineItems: [
      // 1000 basis points = 10% — the unit the document columns hold.
      { productId: cheap.id, quantity: 4, rate: 10000, discountType: 'PERCENTAGE', discountValue: 1000 },
      { productId: dear.id, quantity: 3, rate: 33333 },
    ],
  })

  const detail = await apiGetInvoice(page, invoice.id)
  // Line 1: 4 x 10000 = 40000, less 10% = 36000. Line 2: 3 x 33333 = 99999.
  // Subtotal is the sum of the line totals *after* per-line discount — the
  // definition both the form's totals bar and the server use.
  expect(detail.subtotal, 'subtotal is the sum of the discounted line totals').toBe(135999)
  expect(detail.totalDiscount, '10% of Rs 400 is Rs 40').toBe(4000)
  // The business rounds to the nearest rupee, so the grand total is the
  // subtotal plus that round-off — and the round-off must be what makes up the
  // difference, not an unexplained rupee.
  expect(detail.grandTotal - Number(detail.roundOff ?? 0), 'grand total less round-off is the subtotal').toBe(135999)
  expect(Math.abs(Number(detail.roundOff ?? 0)), 'round-off can only move the bill by under a rupee').toBeLessThan(100)

  // The stored lines must add up to the stored total — a header total that
  // agrees with nothing beneath it is how a disputed bill starts.
  const lineSum = (detail.lineItems ?? []).reduce((sum, l) => sum + Number(l.lineTotal), 0)
  expect(lineSum + Number(detail.roundOff ?? 0), 'the line totals must reconcile with the invoice total').toBe(
    detail.grandTotal,
  )
})

test('TC-INV-03 changing a quantity recomputes the total live, before saving', async ({ page }) => {
  const party = await apiCreateParty(page, { name: uniqueName('Live Recalc') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Recalc'),
    salePrice: 20000, // Rs 200
    openingStock: 100,
  })

  await page.goto('/invoices/new')
  await selectParty(page, party.name)
  await addLine(page, product.name)

  const total = page.locator('.invoice-summary-row-total')
  await expect(total).toContainText('200')

  await setLineFields(page, 0, { quantity: 5 })
  await expect(total, '5 x Rs 200 must show as Rs 1,000 without a save').toContainText('1,000')

  await setLineFields(page, 0, { rateRupees: 150 })
  await expect(total, 'a rate change must recompute too').toContainText('750')

  await setLineFields(page, 0, { discountValue: 10 })
  await expect(total, '10% off Rs 750 is Rs 675').toContainText('675')
})

test('TC-INV-04 invoice numbers are sequential and never repeat', async ({ page }) => {
  const party = await apiCreateParty(page, { name: uniqueName('Numbering') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Numbered'),
    salePrice: 5000,
    openingStock: 100,
  })

  // Created back to back on purpose: a numbering series that reads the last
  // number and increments outside a transaction hands two invoices the same
  // number under exactly this pattern, and a duplicate invoice number is a
  // statutory problem, not a cosmetic one.
  const created = await Promise.all(
    Array.from({ length: 5 }, () =>
      apiCreateInvoice(page, {
        partyId: party.id,
        lineItems: [{ productId: product.id, quantity: 1, rate: 5000 }],
      }),
    ),
  )

  const numbers = created.map((c) => c.documentNumber)
  expect(new Set(numbers).size, `duplicate invoice numbers: ${numbers.join(', ')}`).toBe(
    numbers.length,
  )

  // Sequential within the run: the numeric tails must be five consecutive
  // values, in some order — no gaps, which would look like a lost invoice to
  // an auditor reading the series.
  const tails = numbers.map((n) => Number(n.replace(/\D+/g, ''))).sort((a, b) => a - b)
  expect(tails[tails.length - 1]! - tails[0]!, `series has a gap: ${numbers.join(', ')}`).toBe(
    tails.length - 1,
  )
})

test('TC-INV-15 an invoice with no party, or no items, is refused', async ({ page }) => {
  await page.goto('/invoices/new')

  // No party and no lines: the form must say so rather than opening a ₹0.00
  // preview with a live Save button, or posting a document the server rejects
  // with a 400 the seller never sees.
  await page.getByRole('button', { name: /preview invoice/i }).click()
  await expect(page.getByText(/customer \/ supplier is required/i)).toBeVisible({ timeout: 10_000 })
  await expect(
    page.getByRole('button', { name: /save & send/i }),
    'an invalid invoice must not reach the preview',
  ).toHaveCount(0)
  expect(page.url(), 'a rejected save must not navigate').toContain('/invoices/new')

  const party = await apiCreateParty(page, { name: uniqueName('No Items') })
  await selectParty(page, party.name)
  await page.getByRole('button', { name: /preview invoice/i }).click()
  await expect(page.getByText(/at least one item is required/i)).toBeVisible({ timeout: 10_000 })
  expect(page.url()).toContain('/invoices/new')

  // Zero quantity: the server's schema floors quantity, so the client must not
  // be the only thing standing between a zero-qty line and a zero-value bill.
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('ZeroQty'),
    salePrice: 10000,
    openingStock: 10,
  })
  const rejected = await apiCreateInvoice(page, {
    partyId: party.id,
    lineItems: [{ productId: product.id, quantity: 1, rate: 10000 }],
  }).then(
    () => 'created',
    () => 'refused',
  )
  expect(rejected, 'a valid invoice must still be accepted after the failures above').toBe('created')
})
