/**
 * Purchase helpers for Suite S (plan §16, TC-PUR-01..08).
 *
 * A purchase is the mirror of a sale and every mirror is a place a sign can
 * flip: stock goes UP, the party balance goes NEGATIVE (we owe them), the tax
 * is input credit rather than output liability, and the cost of what is now on
 * the shelf changes. Each of those lives in a different service, so every
 * helper here reads the SERVER's stored value — a purchase screen that looks
 * right while the cost basis silently stays at zero is exactly the failure a
 * UI-level assertion cannot see.
 */

import type { Page } from '@playwright/test'
import { csrfPost } from './fixtures'
import { API } from './parties'
import { today } from './invoices'
import type { CreatedInvoice, InvoiceLineInput } from './invoices'

export { API, today }
export type { InvoiceLineInput }

interface DocBody {
  partyId: string
  lineItems: InvoiceLineInput[]
  [key: string]: unknown
}

function postDoc(page: Page, type: string, body: DocBody) {
  return csrfPost(page, `${API}/documents`, {
    type,
    status: 'SAVED',
    documentDate: today(),
    ...body,
    lineItems: body.lineItems.map((l) => ({
      discountType: 'PERCENTAGE',
      discountValue: 0,
      ...l,
    })),
  })
}

/** The raw response — for cases whose subject is a REFUSAL. */
export function apiCreatePurchaseResponse(page: Page, body: DocBody) {
  return postDoc(page, 'PURCHASE_INVOICE', body)
}

/**
 * A supplier bill. SAVED by default: a DRAFT purchase moves neither stock nor
 * the payable, so a case asserting either against a draft would pass for the
 * wrong reason.
 */
export async function apiCreatePurchase(page: Page, body: DocBody): Promise<CreatedInvoice> {
  const res = await postDoc(page, 'PURCHASE_INVOICE', body)
  if (!res.ok()) throw new Error(`create purchase failed (${res.status()}): ${await res.text()}`)
  return unwrapDoc(await res.json())
}

/**
 * A purchase return. The server requires `originalDocumentId` to point at a
 * PURCHASE_INVOICE (server/src/services/document/create.ts) — a debit note
 * hanging off a sale would be a different document entirely.
 */
export async function apiCreateDebitNote(
  page: Page,
  body: DocBody & { originalDocumentId: string },
): Promise<CreatedInvoice> {
  const res = await postDoc(page, 'DEBIT_NOTE', body)
  if (!res.ok()) throw new Error(`create debit note failed (${res.status()}): ${await res.text()}`)
  return unwrapDoc(await res.json())
}

/**
 * A customer return. Goods come back IN — the mirror of the debit note — and
 * its line carries the SALE price, which is why the cost-basis case exists.
 */
export async function apiCreateCreditNote(
  page: Page,
  body: DocBody & { originalDocumentId: string },
): Promise<CreatedInvoice> {
  const res = await postDoc(page, 'CREDIT_NOTE', body)
  if (!res.ok()) throw new Error(`create credit note failed (${res.status()}): ${await res.text()}`)
  return unwrapDoc(await res.json())
}

function unwrapDoc(envelope: unknown): CreatedInvoice {
  const body = envelope as { data?: CreatedInvoice & { document?: CreatedInvoice } }
  const doc = body.data?.document ?? body.data
  if (!doc?.id) throw new Error(`document create returned no id: ${JSON.stringify(envelope)}`)
  return doc
}

/**
 * The party's stored balance, signed as the books hold it: positive = the party
 * owes the shop, negative = the shop owes the party. Suite L reads the
 * customer-facing `/payments/outstanding/:id` view; a payable has to be read
 * from the party row itself, because a supplier has no "outstanding invoices".
 */
export async function apiPartyBalance(page: Page, partyId: string): Promise<number> {
  const res = await page.request.get(`${API}/parties/${partyId}`)
  if (!res.ok()) throw new Error(`get party ${partyId} failed (${res.status()})`)
  const body = (await res.json()) as {
    data?: { party?: { outstandingBalance?: number }; outstandingBalance?: number }
  }
  const balance = body.data?.party?.outstandingBalance ?? body.data?.outstandingBalance
  if (typeof balance !== 'number') {
    throw new Error(`no outstandingBalance on party: ${JSON.stringify(body).slice(0, 300)}`)
  }
  return balance
}

export interface StockValueRow {
  productId: string
  productName: string
  currentStock: number
  /** paise — the weighted-average cost the valuation is priced at */
  unitCostPaise: number
  /** paise — currentStock × unitCostPaise, floored, as the report computes it */
  totalPaise: number
}

export interface StockValueReport {
  items: StockValueRow[]
  totalValuePaise: number
  productCount: number
}

/**
 * GET /api/reports/stock-value — the valuation a balance sheet is built from.
 * Money crosses the wire as strings (BigInt paise); a helper that left them as
 * strings would make `expect(x).toBe(150000)` fail on a correct report.
 */
export async function apiStockValueReport(page: Page, limit = 100): Promise<StockValueReport> {
  const res = await page.request.get(`${API}/reports/stock-value?limit=${limit}`)
  if (!res.ok()) throw new Error(`stock-value report failed (${res.status()}): ${await res.text()}`)
  const body = (await res.json()) as {
    data?: {
      items?: Array<Record<string, unknown>>
      summary?: { totalValuePaise?: string; productCount?: number }
    }
  }
  const items = (body.data?.items ?? []).map((r) => ({
    productId: String(r.productId),
    productName: String(r.productName),
    currentStock: Number(r.currentStock),
    unitCostPaise: Number(r.unitCostPaise),
    totalPaise: Number(r.totalPaise),
  }))
  return {
    items,
    totalValuePaise: Number(body.data?.summary?.totalValuePaise ?? 0),
    productCount: Number(body.data?.summary?.productCount ?? 0),
  }
}

/** The valuation row for one product, or null when the report omits it. */
export async function apiStockValueRow(
  page: Page,
  productId: string,
): Promise<StockValueRow | null> {
  const report = await apiStockValueReport(page)
  return report.items.find((r) => r.productId === productId) ?? null
}
