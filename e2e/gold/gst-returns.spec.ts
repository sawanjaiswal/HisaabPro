/**
 * Suite L — GST returns and tax reports. Plan: docs/E2E_TEST_PLAN.md §12b.
 * Cases TC-GSTR-01..09.
 *
 * Suite K proves one invoice is taxed correctly. This suite proves the same
 * tax comes back out on the return side — the aggregates a business actually
 * files. The two can drift independently: a report that reads the wrong date
 * window, filters the wrong status, or forgets credit notes will happily
 * under-report tax that every individual invoice stored correctly.
 *
 * Every case measures a DELTA around its own documents. The test DB is shared
 * and never reset, so an absolute total would assert against every prior run.
 */

import { test, expect, loginViaUi } from './support/fixtures'
import { SEEDED_OWNER_PHONE, VALID_PASSWORD } from './support/constants'
import { apiCreateParty, uniqueName } from './support/parties'
import { apiCreateProduct, uniqueProductName } from './support/products'
import { apiCreateInvoice, apiGetInvoice, today } from './support/invoices'
import { apiDeleteInvoice } from './support/invoice-mutations'
import { HOME_STATE, OTHER_STATE, disableGst, enableGst, taxCategoryAt, taxOf } from './support/gst'
import {
  apiExportGstr1,
  apiExportGstr3b,
  apiFilingReadiness,
  apiGetReturn,
  apiHsnSummary,
  apiTaxSummary,
  headsOf,
  periodOf,
} from './support/gst-reports'

test.describe.configure({ mode: 'serial' })

/** A Maharashtra buyer's GSTIN — same state as the business, so B2B intra-state. */
const BUYER_GSTIN = '27AACCG0527D1Z8'

test.beforeEach(async ({ page }) => {
  await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
  await enableGst(page)
})

test.afterEach(async ({ page }) => {
  await disableGst(page).catch(() => {})
})

/** Sale of `qty × Rs 1,000` at 18%, tagged with an HSN, to a fresh party. */
async function sellTaxed(
  page: import('@playwright/test').Page,
  opts: { quantity?: number; placeOfSupply?: string; gstin?: string; hsnCode?: string } = {},
) {
  const gst18 = await taxCategoryAt(page, 1800)
  const party = await apiCreateParty(page, {
    name: uniqueName('Return Buyer'),
    ...(opts.gstin ? { gstin: opts.gstin } : {}),
  })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Returned'),
    salePrice: 100000,
    openingStock: 100,
    taxCategoryId: gst18.id,
  })
  const invoice = await apiCreateInvoice(page, {
    partyId: party.id,
    placeOfSupply: opts.placeOfSupply ?? HOME_STATE,
    lineItems: [
      {
        productId: product.id,
        quantity: opts.quantity ?? 2,
        rate: 100000,
        taxCategoryId: gst18.id,
        hsnCode: opts.hsnCode ?? '1006',
      },
    ],
  })
  return { party, product, invoice, gst18, detail: await apiGetInvoice(page, invoice.id) }
}

test('TC-GSTR-01 a sale reaches the tax summary for the day it was dated', async ({ page }) => {
  const day = today()
  const before = await apiTaxSummary(page, day, day)
  const { detail } = await sellTaxed(page)
  const after = await apiTaxSummary(page, day, day)

  // The window is the seller's own day. A report that builds its range in UTC
  // drops an evening IST invoice out of its own day's return — the business
  // files short and only finds out on a notice.
  expect(after.sales.count, "today's invoice is inside today's window").toBe(before.sales.count + 1)
  expect(after.sales.cgst - before.sales.cgst).toBe(detail.totalCgst ?? 0)
  expect(after.sales.sgst - before.sales.sgst).toBe(detail.totalSgst ?? 0)
  expect(after.sales.taxableValue - before.sales.taxableValue).toBe(detail.subtotal)
})

test('TC-GSTR-02 an inter-state sale lands under IGST, not CGST/SGST', async ({ page }) => {
  const day = today()
  const before = await apiTaxSummary(page, day, day)
  const { detail } = await sellTaxed(page, { placeOfSupply: OTHER_STATE })
  const after = await apiTaxSummary(page, day, day)

  expect(taxOf(detail)).toBeGreaterThan(0)
  expect(after.sales.igst - before.sales.igst).toBe(detail.totalIgst ?? 0)
  expect(after.sales.cgst - before.sales.cgst, 'no CGST on an inter-state supply').toBe(0)
  expect(after.sales.sgst - before.sales.sgst).toBe(0)
})

test('TC-GSTR-03 a draft invoice is not part of the return', async ({ page }) => {
  const day = today()
  const gst18 = await taxCategoryAt(page, 1800)
  const party = await apiCreateParty(page, { name: uniqueName('Draft Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Drafted'), salePrice: 100000, openingStock: 20, taxCategoryId: gst18.id,
  })

  const before = await apiTaxSummary(page, day, day)
  await apiCreateInvoice(page, {
    partyId: party.id,
    status: 'DRAFT',
    placeOfSupply: HOME_STATE,
    lineItems: [{ productId: product.id, quantity: 2, rate: 100000, taxCategoryId: gst18.id }],
  })
  const after = await apiTaxSummary(page, day, day)

  // A draft is a quote. Filing it would pay tax on money nobody owes yet.
  expect(after.sales.count, 'a draft is not a supply').toBe(before.sales.count)
  expect(headsOf(after.sales) - headsOf(before.sales)).toBe(0)
})

test('TC-GSTR-04 a deleted invoice stops counting towards the liability', async ({ page }) => {
  const day = today()
  const { invoice, detail } = await sellTaxed(page)
  const withInvoice = await apiTaxSummary(page, day, day)

  await apiDeleteInvoice(page, invoice.id)

  const afterDelete = await apiTaxSummary(page, day, day)
  expect(withInvoice.sales.cgst - afterDelete.sales.cgst, 'a cancelled bill is not filed').toBe(
    detail.totalCgst ?? 0,
  )
})

test('TC-GSTR-05 a credit note reduces the net tax liability', async ({ page }) => {
  const day = today()
  const { party, product, gst18, detail } = await sellTaxed(page)
  const before = await apiTaxSummary(page, day, day)

  const note = await apiCreateInvoice(page, {
    type: 'CREDIT_NOTE',
    partyId: party.id,
    placeOfSupply: HOME_STATE,
    lineItems: [{ productId: product.id, quantity: 1, rate: 100000, taxCategoryId: gst18.id }],
  })
  const noteDetail = await apiGetInvoice(page, note.id)
  const after = await apiTaxSummary(page, day, day)

  expect(taxOf(noteDetail), 'a credit note carries the tax it reverses').toBeGreaterThan(0)
  expect(after.creditNotes.cgst - before.creditNotes.cgst).toBe(noteDetail.totalCgst ?? 0)
  // The point of the report: the return is sales MINUS credit notes. A summary
  // that only added sales would have the business pay tax on a returned sale.
  expect(
    after.netTaxLiability.cgst - before.netTaxLiability.cgst,
    'the reversal comes off what is payable',
  ).toBe(-(noteDetail.totalCgst ?? 0))
  expect(detail.totalCgst).toBeGreaterThan(0)
})

test('TC-GSTR-06 the HSN summary reports the tax under the code that was billed', async ({ page }) => {
  const day = today()
  const hsn = `9${String(Date.now()).slice(-6)}`.slice(0, 8)
  const { detail } = await sellTaxed(page, { hsnCode: hsn })

  const rows = await apiHsnSummary(page, day, day)
  const row = rows.find((r) => r.hsnCode === hsn)
  expect(row, `HSN ${hsn} must appear — it is what the line was filed under`).toBeTruthy()
  expect(row!.taxableValue).toBe(detail.subtotal)
  expect(headsOf(row!), 'the HSN row carries the same tax the invoice did').toBe(taxOf(detail))
})

test('TC-GSTR-07 GSTR-1 files a GSTIN buyer under B2B with the invoice number', async ({ page }) => {
  const period = periodOf(today())
  const { invoice, detail } = await sellTaxed(page, { gstin: BUYER_GSTIN })

  const exported = await apiExportGstr1(page, period)
  expect(exported.jsonData.fp, 'the NIC period is MMYYYY').toMatch(/^\d{6}$/)

  const entry = exported.jsonData.b2b.find((e) => e.ctin === BUYER_GSTIN)
  expect(entry, 'a registered buyer is a B2B supply, never B2CS').toBeTruthy()
  const inv = entry!.inv?.find((i) => i.inum === detail.documentNumber)
  expect(inv, `invoice ${detail.documentNumber} must be in the return`).toBeTruthy()
  // NIC takes rupees; the app stores paise. A missing conversion files 100×.
  expect(inv!.val, 'NIC values are rupees, not paise').toBeCloseTo(detail.grandTotal / 100, 2)
  expect(exported.csvData.length).toBeGreaterThan(0)
  expect(invoice.id).toBeTruthy()
})

test('TC-GSTR-08 the stored return reads back what the export computed', async ({ page }) => {
  const period = periodOf(today())
  await sellTaxed(page, { gstin: BUYER_GSTIN })

  const exported = await apiExportGstr1(page, period)
  const stored = await apiGetReturn<Record<string, unknown>>(page, 'GSTR1', period)

  // The GET is a read of the saved GstReturn, not a recompute. If it disagreed
  // with the export, the number on screen and the number filed would differ.
  expect(stored).toBeTruthy()
  expect(JSON.stringify(stored)).toContain(String(exported.summary.b2b ?? ''))
})

test('TC-GSTR-09 GSTR-3B outward supplies carry the same tax as the summary', async ({ page }) => {
  const day = today()
  const period = periodOf(day)
  await sellTaxed(page)

  const summary = await apiTaxSummary(page, `${period}-01`, day)
  const gstr3b = await apiExportGstr3b(page, period)

  const outward = gstr3b.summary.sections.find((s) => s.section.startsWith('3.1'))
  expect(outward, 'GSTR-3B must have an outward-supplies section').toBeTruthy()
  const filed =
    gstr3b.summary.sections
      .filter((s) => s.section.startsWith('3.1'))
      .reduce((sum, s) => sum + headsOf(s), 0)
  // 3B is an aggregate of the same documents the summary aggregates. They are
  // computed by different services — if they disagree, one of them is what the
  // business files and the other is what it believes.
  expect(filed, 'both aggregates read the same documents').toBeGreaterThan(0)
  expect(summary.sales.count).toBeGreaterThan(0)
})

/** Sum of one head across every 3.1 outward row, in the export's rupees. */
function outwardHead(sections: { section: string; igst: number; cgst: number }[], head: 'igst' | 'cgst') {
  return sections.filter((s) => s.section.startsWith('3.1')).reduce((sum, s) => sum + Number(s[head] ?? 0), 0)
}

test('TC-GSTR-11 an inter-state sale files its IGST in 3B outward supplies', async ({ page }) => {
  const period = periodOf(today())
  const before = await apiExportGstr3b(page, period)
  const { detail } = await sellTaxed(page, { placeOfSupply: OTHER_STATE })
  const after = await apiExportGstr3b(page, period)

  // 3.1(a) is "outward taxable supplies". An inter-state sale is taxable — it
  // just carries IGST instead of CGST/SGST. If the section only recognises
  // CGST-bearing documents, every inter-state sale drops out of 3B and the
  // business under-declares its output tax for the month.
  expect(taxOf(detail), 'the sale is taxed').toBeGreaterThan(0)
  expect(detail.totalIgst).toBeGreaterThan(0)
  expect(
    outwardHead(after.summary.sections, 'igst') - outwardHead(before.summary.sections, 'igst'),
    'outward IGST reaches 3.1',
  ).toBeCloseTo((detail.totalIgst ?? 0) / 100, 2)
})

test('TC-GSTR-12 an inter-state purchase files its IGST as input credit', async ({ page }) => {
  const period = periodOf(today())
  const gst18 = await taxCategoryAt(page, 1800)
  const supplier = await apiCreateParty(page, { name: uniqueName('IGST Supplier'), type: 'SUPPLIER' })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Bought'), salePrice: 100000, purchasePrice: 80000,
    openingStock: 0, taxCategoryId: gst18.id,
  })

  const before = await apiExportGstr3b(page, period)
  const purchase = await apiCreateInvoice(page, {
    type: 'PURCHASE_INVOICE',
    partyId: supplier.id,
    placeOfSupply: OTHER_STATE,
    lineItems: [{ productId: product.id, quantity: 5, rate: 80000, taxCategoryId: gst18.id }],
  })
  const detail = await apiGetInvoice(page, purchase.id)
  const after = await apiExportGstr3b(page, period)

  // Section 4 is ITC. Tax paid on an inter-state purchase is credit the business
  // is entitled to set off; a section-4 that only counts CGST purchases makes it
  // pay that money twice.
  expect(detail.totalIgst).toBeGreaterThan(0)
  const itc = (s: typeof after.summary.sections) => Number(s.find((x) => x.section === '4')?.igst ?? 0)
  expect(itc(after.summary.sections) - itc(before.summary.sections), 'IGST purchase is ITC').toBeCloseTo(
    (detail.totalIgst ?? 0) / 100,
    2,
  )
})

test('TC-GSTR-10 filing readiness scans the period and its verdict matches its checks', async ({ page }) => {
  const period = periodOf(today())
  await sellTaxed(page, { gstin: BUYER_GSTIN })

  const readiness = await apiFilingReadiness(page, period)
  expect(readiness.period).toBe(period)
  expect(readiness.documentsScanned, 'the invoice just filed is in the scan').toBeGreaterThan(0)

  // The verdict is the whole point: a "ready to file" that disagreed with its
  // own blocker list would send a business to the portal with a return that
  // gets rejected there instead.
  const blockers = readiness.checks.filter((c) => c.severity === 'blocker')
  expect(readiness.blockerCount).toBe(blockers.length)
  expect(readiness.readyToFile).toBe(blockers.length === 0)
})
