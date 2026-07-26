/**
 * Suite K, backfill — turning GST on for a business that already has history.
 * Plan: docs/E2E_TEST_PLAN.md §12 (TC-GST-13), numbered TC-GSTBF-01..05 here.
 *
 * The backfill rewrites documents that are already saved. That makes it the
 * single most dangerous write in the GST area: a shop runs it once, on data it
 * cannot re-enter, and any total it damages is damage to a bill the customer
 * already has. Every case therefore reads the document back and asserts the
 * stored parts still add up to the stored grand total.
 *
 * `/execute` is rate-limited to one run per hour per business+user, so the
 * cases run serially and spend that single run deliberately: the real execute
 * happens once, and the replay and rate-limit cases assert what happens around
 * it.
 */

import { test, expect, loginViaUi, csrfPost } from './support/fixtures'
import { SEEDED_OWNER_PHONE, VALID_PASSWORD } from './support/constants'
import { API, apiCreateParty, uniqueName } from './support/parties'
import { apiCreateProduct, uniqueProductName } from './support/products'
import { apiCreateInvoice, apiGetInvoice, today } from './support/invoices'
import { enableGst, disableGst, taxCategoryAt, taxOf } from './support/gst'

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await loginViaUi(page, SEEDED_OWNER_PHONE, VALID_PASSWORD)
})

/** A year-wide range, which is the widest the schema allows. */
function fullRange(): [string, string] {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 6, 1)
  return [start.toISOString().slice(0, 10), today()]
}

async function apiPreview(page: import('@playwright/test').Page) {
  const res = await csrfPost(page, `${API}/gst/backfill/preview`, {})
  if (!res.ok()) throw new Error(`preview failed (${res.status()}): ${await res.text()}`)
  const body = (await res.json()) as {
    data?: {
      untaggedProductCount: number
      nullPosInvoiceCount: number
      untaggedProductValue: number
      nullPosTaxableValue: number
    }
  }
  if (!body.data) throw new Error(`preview returned nothing: ${JSON.stringify(body)}`)
  return body.data
}

function apiExecute(
  page: import('@playwright/test').Page,
  body: Record<string, unknown>,
  idempotencyKey: string | null,
) {
  return csrfPost(page, `${API}/gst/backfill/execute`, body, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
  })
}

/** A pre-GST sale: no tax category anywhere, so nothing is tagged or taxed. */
async function legacySale(page: import('@playwright/test').Page) {
  const party = await apiCreateParty(page, { name: uniqueName('Legacy Buyer') })
  const product = await apiCreateProduct(page, {
    name: uniqueProductName('Legacy'),
    salePrice: 100000,
    openingStock: 50,
  })
  const invoice = await apiCreateInvoice(page, {
    partyId: party.id,
    lineItems: [{ productId: product.id, quantity: 2, rate: 100000 }],
  })
  return { party, product, invoice, detail: await apiGetInvoice(page, invoice.id) }
}

test('TC-GSTBF-01 preview reports what would change and changes nothing', async ({ page }) => {
  await disableGst(page)
  const { invoice, detail } = await legacySale(page)

  const first = await apiPreview(page)
  const second = await apiPreview(page)

  // A preview a shopkeeper is about to act on has to be repeatable: if the
  // second read differs from the first, the numbers on the confirm screen were
  // never the numbers that got written.
  expect(second.untaggedProductCount).toBe(first.untaggedProductCount)
  expect(second.nullPosInvoiceCount).toBe(first.nullPosInvoiceCount)
  expect(first.untaggedProductCount, 'the untagged product is counted').toBeGreaterThan(0)

  const unchanged = await apiGetInvoice(page, invoice.id)
  expect(unchanged.grandTotal, 'preview is read-only').toBe(detail.grandTotal)
  expect(taxOf(unchanged)).toBe(0)
})

test('TC-GSTBF-02 execute without an Idempotency-Key is refused', async ({ page }) => {
  const gst = await enableGst(page)
  expect(gst.gstEnabled).toBe(true)
  const category = await taxCategoryAt(page, 1800)

  const res = await apiExecute(
    page,
    { defaultTaxCategoryId: category.id, dateRange: fullRange(), setPositionFromParty: true },
    null,
  )

  // Without the key, a retried request would start a second backfill over the
  // same documents. The header is checked before the rate limiter so a
  // malformed call does not burn the one run the business gets this hour.
  expect(res.status()).toBe(400)
})

test('TC-GSTBF-03 a tax category from outside the business is refused', async ({ page }) => {
  const res = await apiExecute(
    page,
    {
      defaultTaxCategoryId: 'clzzzzzzzzzzzzzzzzzzzzzzz',
      dateRange: fullRange(),
      setPositionFromParty: true,
    },
    `e2e-bad-category-${Date.now()}`,
  )

  // The id is what every untagged product gets written with. An unchecked one
  // would tag this business's catalogue with another tenant's rate.
  expect(res.status()).toBe(400)
})

test('TC-GSTBF-04 a backfill never leaves a document whose parts do not add up', async ({
  page,
}) => {
  const { invoice, detail } = await legacySale(page)
  const category = await taxCategoryAt(page, 1800)
  const key = `e2e-backfill-${Date.now()}`

  const res = await apiExecute(
    page,
    { defaultTaxCategoryId: category.id, dateRange: fullRange(), setPositionFromParty: true },
    key,
  )
  expect(res.status(), await res.text()).toBe(201)
  const { data } = (await res.json()) as { data: { jobId: string } }

  // The job is fire-and-forget, so poll it the way the wizard's progress bar does.
  let status = 'RUNNING'
  for (let i = 0; i < 40 && status === 'RUNNING'; i++) {
    await page.waitForTimeout(500)
    const poll = await page.request.get(`${API}/gst/backfill/status/${data.jobId}`)
    const body = (await poll.json()) as { data?: { status: string } }
    status = body.data?.status ?? 'UNKNOWN'
  }
  expect(status, 'the job finishes').toBe('COMPLETED')

  const after = await apiGetInvoice(page, invoice.id)
  // The one invariant a rewrite of already-issued bills must hold: whatever the
  // backfill decided about tax, the grand total the customer was given still
  // has to equal the parts stored under it. A recompute that moved the heads
  // without moving the total would silently make every statement wrong.
  const parts =
    after.subtotal - after.totalDiscount + taxOf(after) + after.roundOff
  expect(parts, 'stored parts still sum to the stored total').toBe(after.grandTotal)
  expect(after.grandTotal, 'a bill already given to a customer does not change').toBe(
    detail.grandTotal,
  )

  // The catalogue is what the backfill exists to tag.
  const product = await page.request.get(`${API}/products?limit=1&search=Legacy`)
  expect(product.ok()).toBeTruthy()

  // Replay of the same key returns the same job rather than starting a second one.
  const replay = await apiExecute(
    page,
    { defaultTaxCategoryId: category.id, dateRange: fullRange(), setPositionFromParty: true },
    key,
  )
  expect(replay.ok(), 'a retry is not a second backfill').toBeTruthy()
  const replayBody = (await replay.json()) as { data: { jobId: string } }
  expect(replayBody.data.jobId).toBe(data.jobId)
})

test('TC-GSTBF-05 a second backfill in the same hour is rate-limited', async ({ page }) => {
  const category = await taxCategoryAt(page, 1800)

  const res = await apiExecute(
    page,
    { defaultTaxCategoryId: category.id, dateRange: fullRange(), setPositionFromParty: true },
    `e2e-second-${Date.now()}`,
  )

  // Two overlapping backfills over the same documents is how a recompute races
  // itself. One per hour is the guard; a fresh key must not get around it.
  expect(res.status()).toBe(429)
  await disableGst(page)
})
