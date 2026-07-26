/**
 * Invoice helpers for the gold suites (plan §11 Suite J, §12 Suite K).
 *
 * Same rule as the party and product helpers: building an invoice through the
 * form is what TC-INV-01 tests, so every case whose subject is something else
 * (edit, delete, payment, GST arithmetic) arranges its invoice over the API.
 *
 * Money is paise everywhere on the wire. A helper that took rupees would put
 * the rupee→paise conversion inside the harness, which is exactly the
 * conversion several of these cases exist to catch.
 */

import type { Page } from '@playwright/test'
import { csrfPost } from './fixtures'
import { API } from './parties'

export { API }

export interface InvoiceLineInput {
  productId: string
  quantity: number
  /** paise */
  rate: number
  discountType?: 'AMOUNT' | 'PERCENTAGE'
  /** paise when AMOUNT, basis points when PERCENTAGE (1000 = 10%) */
  discountValue?: number
  taxCategoryId?: string
  hsnCode?: string
}

export interface CreatedInvoice {
  id: string
  documentNumber: string
  grandTotal: number
  subtotal: number
  status: string
}

/** Today as the server's `documentDate` wants it (YYYY-MM-DD, local). */
export function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Creates a document over the API using the logged-in page's own session.
 *
 * `status` defaults to SAVED because a DRAFT does not touch stock, the ledger
 * or the numbering series — a case that meant to assert any of those against a
 * draft would pass for the wrong reason.
 */
export async function apiCreateInvoice(
  page: Page,
  body: {
    partyId: string
    lineItems: InvoiceLineInput[]
    status?: 'SAVED' | 'DRAFT'
    [key: string]: unknown
  },
): Promise<CreatedInvoice> {
  const res = await postDocument(page, body)
  if (!res.ok()) throw new Error(`create document failed (${res.status()}): ${await res.text()}`)
  const envelope = (await res.json()) as { data?: CreatedInvoice & { document?: CreatedInvoice } }
  const doc = envelope.data?.document ?? envelope.data
  if (!doc?.id) throw new Error(`create document returned no id: ${JSON.stringify(envelope)}`)
  return doc
}

/**
 * The raw response, for cases whose subject is a REFUSAL. `apiCreateInvoice`
 * throws on a non-2xx, which is right when the create is arrangement — but a
 * case asserting "the server must reject this" has to read the status and the
 * message the seller would be shown.
 */
export async function apiCreateInvoiceResponse(
  page: Page,
  body: { partyId: string; lineItems: InvoiceLineInput[]; [key: string]: unknown },
) {
  return postDocument(page, body)
}

function postDocument(
  page: Page,
  body: { partyId: string; lineItems: InvoiceLineInput[]; [key: string]: unknown },
) {
  return csrfPost(page, `${API}/documents`, {
    type: 'SALE_INVOICE',
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

export interface InvoiceDetail {
  id: string
  documentNumber: string
  status: string
  subtotal: number
  totalDiscount: number
  totalCess?: number
  /** GST split — CGST+SGST intra-state, IGST inter-state. Never both. */
  totalCgst?: number
  totalSgst?: number
  totalIgst?: number
  placeOfSupply?: string | null
  /** paise added/removed by the business's round-off setting */
  roundOff: number
  grandTotal: number
  /** Settlement columns, named as the Document model holds them. */
  paidAmount?: number
  balanceDue?: number
  lineItems?: Array<{
    productId: string
    quantity: number
    rate: number
    lineTotal: number
    cgstAmount?: number
    sgstAmount?: number
    igstAmount?: number
    cessAmount?: number
    hsnCode?: string | null
  }>
}

/** The document as the server holds it — the only trustworthy totals. */
export async function apiGetInvoice(page: Page, id: string): Promise<InvoiceDetail> {
  const res = await page.request.get(`${API}/documents/${id}`)
  if (!res.ok()) throw new Error(`get document ${id} failed (${res.status()})`)
  const body = (await res.json()) as { data?: InvoiceDetail & { document?: InvoiceDetail } }
  const doc = body.data?.document ?? body.data
  if (!doc?.id) throw new Error(`get document returned nothing: ${JSON.stringify(body)}`)
  return doc
}

/** Documents of one type, newest first — used to assert list membership. */
export async function apiListInvoices(
  page: Page,
  query = 'type=SALE_INVOICE&limit=50',
): Promise<InvoiceDetail[]> {
  const res = await page.request.get(`${API}/documents?${query}`)
  const body = (await res.json()) as {
    data?: { documents?: InvoiceDetail[] } | InvoiceDetail[]
  }
  const data = body.data
  return Array.isArray(data) ? data : (data?.documents ?? [])
}

/** Picks a party in the invoice form's search field, the way a seller does. */
export async function selectParty(page: Page, name: string): Promise<void> {
  const input = page.locator('#party-search-input')
  await input.click()
  await input.fill(name)
  // The result list is debounced and server-backed, so wait for the row that
  // matches rather than the first option — "Add new party" also sits in this
  // listbox and clicking it would silently create a duplicate party.
  const option = page.locator('.party-search-result', { hasText: name }).first()
  await option.click({ timeout: 20_000 })
}

/**
 * Adds a product line in the invoice form. Opens the item search if it is not
 * already open — picking a party auto-opens it for the first line only, so the
 * second line onwards has to open it again.
 */
export async function addLine(page: Page, productName: string): Promise<void> {
  const search = page.locator('#product-search-input')
  if (!(await search.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /add item/i }).first().click()
  }
  await search.fill(productName)
  const result = page.locator('.product-search-result', { hasText: productName }).first()
  await result.getByRole('button', { name: /add/i }).click({ timeout: 20_000 })
}

/** Sets quantity / rate / discount on the nth line (0-based), as the form does. */
export async function setLineFields(
  page: Page,
  index: number,
  fields: { quantity?: number; rateRupees?: number; discountValue?: number },
): Promise<void> {
  if (fields.quantity !== undefined) {
    await page.locator(`#line-qty-${index}`).fill(String(fields.quantity))
  }
  if (fields.rateRupees !== undefined) {
    await page.locator(`#line-rate-${index}`).fill(String(fields.rateRupees))
  }
  if (fields.discountValue !== undefined) {
    await page.locator(`#line-discount-${index}`).fill(String(fields.discountValue))
  }
}

/** Rupees as the totals bar renders them, for comparing against paise maths. */
export function rupees(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}
