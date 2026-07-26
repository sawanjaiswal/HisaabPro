/**
 * POS helpers for the gold suites (plan §14, Suite R).
 *
 * A POS sale is the one document the shopkeeper creates while a customer is
 * standing there, so every case here arranges its cart over the API and asks
 * the server what it stored — the counter UI is exercised separately.
 */

import type { Page, APIResponse } from '@playwright/test'
import { csrfRequest } from './fixtures'
import { API } from './parties'

export { API }

export interface PosLineInput {
  productId: string
  quantity: number
  discountType?: 'AMOUNT' | 'PERCENTAGE'
  discountValue?: number
}

export interface PosPaymentInput {
  mode: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other'
  amountPaise: number
  referenceNumber?: string
}

export interface PosSale {
  id: string
  receiptNumber: string
  subtotal: number
  totalDiscount: number
  totalTaxableValue: number
  totalCgst: number
  totalSgst: number
  totalIgst: number
  grandTotal: number
  status: string
  partyId: string | null
  walkInName: string | null
  paymentBreakdown: unknown
  items: Array<{ productId: string; quantity: number; lineTotal?: number }>
  warnings: string[]
}

/** The checkout requires a v4 key; `crypto.randomUUID()` is one. */
export function idempotencyKey(): string {
  return crypto.randomUUID()
}

/**
 * Posts a checkout. The key is echoed in both the header (the middleware reads
 * it) and the body (the schema requires it) — a mismatch between the two is
 * itself worth catching, so callers pass one value for both.
 */
export function posCheckout(
  page: Page,
  body: Record<string, unknown>,
  key: string,
): Promise<APIResponse> {
  return csrfRequest(
    page,
    'post',
    `${API}/pos/sales`,
    { idempotencyKey: key, ...body },
    { headers: { 'X-Idempotency-Key': key } },
  )
}

/** Same call, but a non-201 is a test failure rather than a value to inspect. */
export async function apiPosSale(
  page: Page,
  body: Record<string, unknown>,
  key = idempotencyKey(),
): Promise<PosSale> {
  const res = await posCheckout(page, body, key)
  if (!res.ok()) throw new Error(`pos checkout failed (${res.status()}): ${await res.text()}`)
  const envelope = (await res.json()) as { data?: PosSale }
  if (!envelope.data?.id) throw new Error(`pos checkout returned no sale: ${JSON.stringify(envelope)}`)
  return envelope.data
}

/** Current stock for a product, straight from the server's own read model. */
export async function apiStock(page: Page, productId: string): Promise<number> {
  const res = await page.request.get(`${API}/products/${productId}`)
  if (!res.ok()) throw new Error(`read product failed (${res.status()}): ${await res.text()}`)
  const envelope = (await res.json()) as { data?: { product?: { currentStock?: number } } }
  return Number(envelope.data?.product?.currentStock ?? 0)
}

/**
 * Flips the business-level oversell policy and returns a restore function, so
 * a case that needs HARD_BLOCK cannot leave it set for whatever runs next.
 */
export async function setStockPolicy(
  page: Page,
  mode: 'WARN_ONLY' | 'HARD_BLOCK',
): Promise<() => Promise<void>> {
  const before = await page.request.get(`${API}/settings/inventory`)
  const body = (await before.json()) as { data?: { stockValidationMode?: string } }
  const previous = (body.data?.stockValidationMode ?? 'WARN_ONLY') as 'WARN_ONLY' | 'HARD_BLOCK'
  const apply = async (value: string) => {
    const res = await csrfRequest(page, 'put', `${API}/settings/inventory`, {
      stockValidationMode: value,
    })
    if (!res.ok()) throw new Error(`set stock policy failed (${res.status()}): ${await res.text()}`)
  }
  await apply(mode)
  return () => apply(previous)
}
