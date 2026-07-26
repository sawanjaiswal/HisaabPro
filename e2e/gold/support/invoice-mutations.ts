/**
 * Invoice mutation helpers — edit, delete, payment, ledger reads.
 *
 * Split from `invoices.ts` so each file keeps one job: that one arranges an
 * invoice, this one changes or settles it and reads back what the change did to
 * the rest of the books (stock, ledger, recycle bin). The cases in Suite J
 * part 2 all assert a side effect rather than the document itself, and the side
 * effect is the thing that silently stops happening.
 */

import type { Page } from '@playwright/test'
import { csrfPost, csrfRequest } from './fixtures'
import { API } from './parties'
import { today } from './invoices'
import type { InvoiceDetail, InvoiceLineInput } from './invoices'

/** Replaces a saved document's lines/party over the API (PUT is a full update). */
export async function apiUpdateInvoice(
  page: Page,
  id: string,
  body: { lineItems?: InvoiceLineInput[]; [key: string]: unknown },
): Promise<void> {
  const res = await csrfRequest(page, 'put', `${API}/documents/${id}`, {
    ...body,
    lineItems: body.lineItems?.map((l) => ({
      discountType: 'PERCENTAGE',
      discountValue: 0,
      ...l,
    })),
  })
  if (!res.ok()) throw new Error(`update document failed (${res.status()}): ${await res.text()}`)
}

/** Soft-deletes a document to the recycle bin. */
export async function apiDeleteInvoice(page: Page, id: string): Promise<void> {
  const res = await csrfRequest(page, 'delete', `${API}/documents/${id}`)
  if (!res.ok()) throw new Error(`delete document failed (${res.status()}): ${await res.text()}`)
}

/** Ids currently sitting in the recycle bin — proof a delete was a soft delete. */
export async function apiRecycleBinIds(page: Page): Promise<string[]> {
  const res = await page.request.get(`${API}/documents/recycle-bin?limit=50`)
  const body = (await res.json()) as {
    data?: { documents?: Array<{ id: string }> } | Array<{ id: string }>
  }
  const data = body.data
  const rows = Array.isArray(data) ? data : (data?.documents ?? [])
  return rows.map((r) => r.id)
}

/**
 * Records money received against invoices. `allocations` is what ties the
 * payment to a document — a payment without them lands as party advance and
 * leaves the invoice looking unpaid, which is the failure worth catching.
 */
export async function apiCreatePayment(
  page: Page,
  body: {
    partyId: string
    amount: number
    allocations?: Array<{ invoiceId: string; amount: number }>
    [key: string]: unknown
  },
): Promise<{ id: string }> {
  const res = await csrfPost(page, `${API}/payments`, {
    type: 'PAYMENT_IN',
    date: today(),
    mode: 'CASH',
    allocations: [],
    ...body,
  })
  if (!res.ok()) throw new Error(`create payment failed (${res.status()}): ${await res.text()}`)
  const envelope = (await res.json()) as { data?: { payment?: { id: string } } & { id?: string } }
  const payment = envelope.data?.payment ?? envelope.data
  if (!payment?.id) throw new Error(`create payment returned no id: ${JSON.stringify(envelope)}`)
  return payment as { id: string }
}

export interface LedgerRowLite {
  voucherType: string
  voucherNumber: string
  dr: number
  cr: number
}

/**
 * The party's ledger over a window wide enough to include everything a case
 * creates. The ledger is the customer-facing account statement, so an invoice
 * that vanishes from it (or lingers after a delete) is a dispute waiting to
 * happen — the row set matters more than the document row itself.
 */
export async function apiPartyLedger(
  page: Page,
  partyId: string,
): Promise<LedgerRowLite[]> {
  const from = new Date()
  from.setFullYear(from.getFullYear() - 1)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const res = await page.request.get(
    `${API}/parties/${partyId}/ledger?from=${iso(from)}&to=${today()}&limit=200`,
  )
  if (!res.ok()) throw new Error(`ledger failed (${res.status()}): ${await res.text()}`)
  const body = (await res.json()) as { data?: { rows?: LedgerRowLite[] } }
  return body.data?.rows ?? []
}

/** Convenience: the settlement figures a payment case asserts on. */
export function settlement(detail: InvoiceDetail): { paid: number; due: number } {
  return { paid: Number(detail.paidAmount ?? 0), due: Number(detail.balanceDue ?? 0) }
}
