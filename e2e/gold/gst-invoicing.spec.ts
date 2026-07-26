/**
 * Suite K — GST invoicing. Plan: docs/E2E_TEST_PLAN.md §12.
 * Cases TC-GST-01..08 (invoice-side) and TC-GST-17..19 (composition scheme).
 * TC-GST-09..16 are the return-side cases, implemented in gst-returns.spec.ts
 * as the TC-GSTR-* family — the plan numbers them under this same suite.
 *
 * GST is the part of this app a shop cannot fudge: the split it prints is the
 * split it files, and a wrong one is a notice from the department rather than a
 * refund to a customer. Every case therefore asserts the SERVER's stored tax
 * columns, and asserts the split is exclusive — CGST+SGST *or* IGST, never a
 * bit of each, which is the classic symptom of a place-of-supply comparison
 * that silently defaulted.
 *
 * GST is switched on for this file and off again afterwards: the seeded
 * business runs GST-off (what a micro retailer uses, and what Suite J's
 * arithmetic assumes).
 */

import { test, expect, loginViaUi } from './support/fixtures'
import { SEEDED_OWNER_PHONE, VALID_PASSWORD } from './support/constants'
import { apiCreateParty, uniqueName } from './support/parties'
import { apiCreateProduct, uniqueProductName } from './support/products'
import {
  addLine,
  apiCreateInvoice,
  apiCreateInvoiceResponse,
  apiGetInvoice,
  apiListInvoices,
  selectParty,
  setLineFields,
} from './support/invoices'
import {
  HOME_STATE,
  OTHER_STATE,
  disableGst,
  enableGst,
  setCompositionScheme,
  apiGetGstSettings,
  taxCategoryAt,
  taxOf,
  lineTaxOf,
} from './support/gst'

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
  await enableGst(page)
})

test.afterEach(async ({ page }) => {
  await disableGst(page).catch(() => {})
})

test('TC-GST-01 turning GST on records the GSTIN and derives the home state', async ({ page }) => {
  const settings = await apiGetGstSettings(page)
  expect(settings.gstEnabled).toBe(true)
  // The state code is not typed by the user — it is the GSTIN's first two
  // digits, and it is the value every intra/inter-state decision compares
  // against. A GSTIN saved without it makes every supply look intra-state.
  expect(settings.stateCode, 'the home state comes from the GSTIN').toBe(HOME_STATE)
})

test('TC-GST-02 an intra-state sale splits the tax into CGST and SGST', async ({ page }) => {
  const gst18 = await taxCategoryAt(page, 1800)
  const party = await apiCreateParty(page, { name: uniqueName('Local Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Taxed'),
    salePrice: 100000, // Rs 1,000
    openingStock: 50,
    taxCategoryId: gst18.id,
  })

  const invoice = await apiCreateInvoice(page, {
    partyId: party.id,
    placeOfSupply: HOME_STATE,
    lineItems: [
      { productId: product.id, quantity: 2, rate: 100000, taxCategoryId: gst18.id, hsnCode: '1006' },
    ],
  })
  const detail = await apiGetInvoice(page, invoice.id)

  // Rs 2,000 taxable at 18% = Rs 360, split 9% + 9%.
  expect(detail.subtotal).toBe(200000)
  expect(detail.totalCgst, 'CGST is half the rate').toBe(18000)
  expect(detail.totalSgst, 'SGST is the other half').toBe(18000)
  expect(detail.totalIgst, 'an intra-state supply carries no IGST').toBe(0)
  expect(taxOf(detail)).toBe(36000)
  expect(detail.grandTotal - Number(detail.roundOff ?? 0), 'taxable + tax is the bill').toBe(236000)

  const line = detail.lineItems?.[0]
  expect(line?.hsnCode, 'HSN must persist on the line — it is printed and filed').toBe('1006')
  expect(Number(line?.cgstAmount) + Number(line?.sgstAmount), 'the line carries its own split').toBe(
    36000,
  )
})

test('TC-GST-03 an inter-state sale charges IGST and nothing else', async ({ page }) => {
  const gst18 = await taxCategoryAt(page, 1800)
  const party = await apiCreateParty(page, { name: uniqueName('Outstate Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Shipped'),
    salePrice: 100000,
    openingStock: 50,
    taxCategoryId: gst18.id,
  })

  const invoice = await apiCreateInvoice(page, {
    partyId: party.id,
    placeOfSupply: OTHER_STATE,
    lineItems: [{ productId: product.id, quantity: 2, rate: 100000, taxCategoryId: gst18.id }],
  })
  const detail = await apiGetInvoice(page, invoice.id)

  expect(detail.totalIgst, 'IGST carries the whole 18%').toBe(36000)
  expect(detail.totalCgst, 'an inter-state supply carries no CGST').toBe(0)
  expect(detail.totalSgst, 'an inter-state supply carries no SGST').toBe(0)
  // Same money either way — only the heads change. A split that also changed
  // the total would mean the customer pays a different price for the same goods
  // depending on which state they are in.
  expect(taxOf(detail)).toBe(36000)
  expect(detail.grandTotal - Number(detail.roundOff ?? 0)).toBe(236000)
})

test('TC-GST-04 lines at different rates are taxed at their own rate', async ({ page }) => {
  const gst5 = await taxCategoryAt(page, 500)
  const gst18 = await taxCategoryAt(page, 1800)
  const party = await apiCreateParty(page, { name: uniqueName('Mixed Buyer') })
  const food = await apiCreateProduct(page, {
    name: uniqueProductName('Food5'),
    salePrice: 100000,
    openingStock: 50,
    taxCategoryId: gst5.id,
  })
  const gadget = await apiCreateProduct(page, {
    name: uniqueProductName('Gadget18'),
    salePrice: 100000,
    openingStock: 50,
    taxCategoryId: gst18.id,
  })

  const invoice = await apiCreateInvoice(page, {
    partyId: party.id,
    placeOfSupply: HOME_STATE,
    lineItems: [
      { productId: food.id, quantity: 1, rate: 100000, taxCategoryId: gst5.id },
      { productId: gadget.id, quantity: 1, rate: 100000, taxCategoryId: gst18.id },
    ],
  })
  const detail = await apiGetInvoice(page, invoice.id)

  // Rs 1,000 at 5% = Rs 50, Rs 1,000 at 18% = Rs 180. A single blended rate
  // applied to the whole invoice — the shortcut this case exists to catch —
  // would produce Rs 115 each and the same total, so the LINE amounts are what
  // has to be checked, not just the header.
  expect(taxOf(detail), 'Rs 50 + Rs 180').toBe(23000)
  const taxes = (detail.lineItems ?? []).map(lineTaxOf).sort((a, b) => a - b)
  expect(taxes, 'each line taxed at its own rate').toEqual([5000, 18000])
})

test('TC-GST-05 inclusive pricing backs the tax out of the printed rate', async ({ page }) => {
  await enableGst(page, 'INCLUSIVE')
  const gst18 = await taxCategoryAt(page, 1800)
  const party = await apiCreateParty(page, { name: uniqueName('MRP Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('MRP'),
    salePrice: 118000, // Rs 1,180 on the shelf label
    openingStock: 50,
    taxCategoryId: gst18.id,
  })

  const invoice = await apiCreateInvoice(page, {
    partyId: party.id,
    placeOfSupply: HOME_STATE,
    taxPricingMode: 'INCLUSIVE',
    lineItems: [{ productId: product.id, quantity: 1, rate: 118000, taxCategoryId: gst18.id }],
  })
  const detail = await apiGetInvoice(page, invoice.id)

  // A shelf price is what the customer hands over. Rs 1,180 inclusive of 18%
  // is Rs 1,000 taxable + Rs 180 tax — the bill must not come to Rs 1,392.40.
  expect(detail.subtotal, 'the taxable value is backed out of the MRP').toBe(100000)
  expect(taxOf(detail)).toBe(18000)
  expect(detail.grandTotal - Number(detail.roundOff ?? 0), 'the customer pays the shelf price').toBe(
    118000,
  )
})

test('TC-GST-06 reverse charge moves the tax off the customer bill', async ({ page }) => {
  const gst18 = await taxCategoryAt(page, 1800)
  const party = await apiCreateParty(page, { name: uniqueName('RCM Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('RCM'),
    salePrice: 100000,
    openingStock: 50,
    taxCategoryId: gst18.id,
  })

  const invoice = await apiCreateInvoice(page, {
    partyId: party.id,
    placeOfSupply: HOME_STATE,
    isReverseCharge: true,
    lineItems: [{ productId: product.id, quantity: 1, rate: 100000, taxCategoryId: gst18.id }],
  })
  const detail = await apiGetInvoice(page, invoice.id)

  // Under RCM the recipient pays the tax to the government, so the supplier's
  // invoice shows the taxable value and collects no GST. Charging it here would
  // mean the tax is paid twice.
  expect(detail.subtotal).toBe(100000)
  expect(taxOf(detail), 'the supplier collects no tax under reverse charge').toBe(0)
  expect(detail.grandTotal - Number(detail.roundOff ?? 0)).toBe(100000)
})

test('TC-GST-07 an untagged line is billed without tax, not refused', async ({ page }) => {
  const party = await apiCreateParty(page, { name: uniqueName('Untagged Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Untagged'),
    salePrice: 50000,
    openingStock: 50,
  })

  // A GST-registered shop still sells exempt and untagged goods. Refusing the
  // save (or silently applying 18%) both end with a wrong invoice — the first
  // blocks the sale, the second overcharges.
  const invoice = await apiCreateInvoice(page, {
    partyId: party.id,
    placeOfSupply: HOME_STATE,
    lineItems: [{ productId: product.id, quantity: 2, rate: 50000, taxCategoryId: null }],
  })
  const detail = await apiGetInvoice(page, invoice.id)

  expect(detail.subtotal).toBe(100000)
  expect(taxOf(detail), 'no category means no tax, not a default rate').toBe(0)
  expect(detail.grandTotal - Number(detail.roundOff ?? 0)).toBe(100000)
})

test('TC-GST-08 the form shows the tax it is about to charge, and charges what it showed', async ({
  page,
}) => {
  const gst18 = await taxCategoryAt(page, 1800)
  const party = await apiCreateParty(page, { name: uniqueName('Counter Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Counter'),
    salePrice: 100000, // Rs 1,000
    openingStock: 50,
    taxCategoryId: gst18.id,
  })

  await page.goto('/invoices/new')
  await selectParty(page, party.name)
  await addLine(page, product.name)
  await setLineFields(page, 0, { quantity: 2 })

  // The GST card and the totals bar are read by the same person in the same
  // glance. Rs 2,000 of goods at 18% is Rs 360 of tax and Rs 2,360 to collect —
  // a bar that stops at the taxable value sends the seller to the customer with
  // the wrong number, and the invoice that lands in the books says something
  // else again.
  await expect(page.locator('.gst-summary')).toContainText('360')
  await expect(page.locator('.invoice-summary-row-total')).toContainText('2,360')

  await page.getByRole('button', { name: /preview invoice/i }).click()
  await page.getByRole('button', { name: /save & send|saving/i }).click()
  await page.waitForURL('**/invoices', { timeout: 20_000 })

  const [saved] = await apiListInvoices(page, `type=SALE_INVOICE&partyId=${party.id}&limit=10`)
  const detail = await apiGetInvoice(page, saved!.id)
  expect(taxOf(detail), 'the stored tax is the tax the seller was shown').toBe(36000)
  expect(detail.grandTotal - Number(detail.roundOff ?? 0)).toBe(236000)
})

test('TC-GST-17 a composition dealer cannot charge GST on a bill', async ({ page }) => {
  const gst18 = await taxCategoryAt(page, 1800)
  const party = await apiCreateParty(page, { name: uniqueName('Composite Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Composite'), salePrice: 100000, openingStock: 20, taxCategoryId: gst18.id,
  })
  await setCompositionScheme(page, true)

  // A composition dealer pays a flat percent of turnover and issues a Bill of
  // Supply. Charging GST on top collects tax the dealer has no right to collect
  // and cannot pass on — the customer's input credit claim is what surfaces it,
  // months later. The refusal must happen at save, not at print.
  const res = await apiCreateInvoiceResponse(page, {
    partyId: party.id,
    placeOfSupply: HOME_STATE,
    lineItems: [{ productId: product.id, quantity: 1, rate: 100000, taxCategoryId: gst18.id }],
  })
  expect(res.status(), 'a taxed composition invoice is refused').toBe(400)
  expect(await res.text()).toMatch(/composition/i)
})

test('TC-GST-18 a composition dealer cannot sell inter-state', async ({ page }) => {
  const party = await apiCreateParty(page, { name: uniqueName('Outstation Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Outstation'), salePrice: 100000, openingStock: 20,
  })
  await setCompositionScheme(page, true)

  // The scheme is state-bound: an inter-state outward supply disqualifies the
  // dealer from composition entirely, retrospectively for the year.
  const res = await apiCreateInvoiceResponse(page, {
    partyId: party.id,
    placeOfSupply: OTHER_STATE,
    lineItems: [{ productId: product.id, quantity: 1, rate: 100000 }],
  })
  expect(res.status(), 'an inter-state composition supply is refused').toBe(400)
  expect(await res.text()).toMatch(/inter-state/i)
})

test('TC-GST-19 a composition Bill of Supply saves with no tax on it', async ({ page }) => {
  const party = await apiCreateParty(page, { name: uniqueName('Bill Of Supply Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Supplied'), salePrice: 100000, openingStock: 20,
  })
  await setCompositionScheme(page, true)

  const invoice = await apiCreateInvoice(page, {
    partyId: party.id,
    placeOfSupply: HOME_STATE,
    lineItems: [{ productId: product.id, quantity: 3, rate: 100000 }],
  })
  const detail = await apiGetInvoice(page, invoice.id)

  // The dealer's own bill still has to work: goods at their price, no tax
  // column, and the customer pays the subtotal.
  expect(detail.subtotal).toBe(300000)
  expect(taxOf(detail), 'a Bill of Supply carries no tax').toBe(0)
  expect(detail.grandTotal - Number(detail.roundOff ?? 0)).toBe(300000)
})
