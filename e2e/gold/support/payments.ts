/**
 * Payment helpers for Suite L (plan §13).
 *
 * Payments are where a billing app either keeps its books or quietly loses
 * money: an allocation that misses, a delete that does not reverse, or a party
 * balance that drifts are all invisible until a customer disputes a statement.
 * Every helper therefore reads back the SERVER's stored numbers.
 */

import type { Page } from '@playwright/test'
import { csrfRequest, csrfPost } from './fixtures'
import { API } from './parties'

export interface PaymentAllocationInput {
  invoiceId: string
  /** paise */
  amount: number
}

export interface CreatedPayment {
  id: string
  amount: number
  mode: string
  type: string
  allocations?: Array<{ invoiceId: string; amount: number }>
}

/** Today as the payment schema wants it (YYYY-MM-DD). */
export function paymentDate(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export async function apiRecordPaymentResponse(
  page: Page,
  body: {
    partyId: string
    amount: number
    mode?: string
    type?: string
    allocations?: PaymentAllocationInput[]
    [key: string]: unknown
  },
) {
  return csrfPost(page, `${API}/payments`, {
    type: 'PAYMENT_IN',
    mode: 'CASH',
    date: paymentDate(),
    allocations: [],
    ...body,
  })
}

export async function apiRecordPayment(
  page: Page,
  body: {
    partyId: string
    amount: number
    mode?: string
    type?: string
    allocations?: PaymentAllocationInput[]
    [key: string]: unknown
  },
): Promise<CreatedPayment> {
  const res = await apiRecordPaymentResponse(page, body)
  if (!res.ok()) throw new Error(`record payment failed (${res.status()}): ${await res.text()}`)
  const envelope = (await res.json()) as { data?: CreatedPayment & { payment?: CreatedPayment } }
  const payment = envelope.data?.payment ?? envelope.data
  if (!payment?.id) throw new Error(`record payment returned no id: ${JSON.stringify(envelope)}`)
  return payment
}

export async function apiDeletePayment(page: Page, id: string): Promise<void> {
  const res = await csrfRequest(page, 'delete', `${API}/payments/${id}`)
  if (!res.ok()) throw new Error(`delete payment failed (${res.status()}): ${await res.text()}`)
}

export async function apiGetPayment(page: Page, id: string): Promise<Record<string, unknown>> {
  const res = await page.request.get(`${API}/payments/${id}`)
  if (!res.ok()) throw new Error(`get payment ${id} failed (${res.status()})`)
  const body = (await res.json()) as { data?: Record<string, unknown> }
  return (body.data?.payment as Record<string, unknown>) ?? body.data ?? {}
}

export interface PartyOutstanding {
  partyId: string
  partyName: string
  /** paise — positive means the customer owes the shop */
  outstanding: number
  invoices: Array<{ id: string; total: number; paid: number; due: number; daysOverdue: number }>
}

/** The party's outstanding page, invoice list included. */
export async function apiPartyOutstandingDetail(
  page: Page,
  partyId: string,
): Promise<PartyOutstanding> {
  const res = await page.request.get(`${API}/payments/outstanding/${partyId}`)
  if (!res.ok()) throw new Error(`party outstanding failed (${res.status()}): ${await res.text()}`)
  const body = (await res.json()) as { data?: PartyOutstanding }
  if (typeof body.data?.outstanding !== 'number') {
    throw new Error(`no outstanding in response: ${JSON.stringify(body).slice(0, 300)}`)
  }
  return body.data
}

/** What the party owes, as the outstanding page reads it. */
export async function apiPartyOutstanding(page: Page, partyId: string): Promise<number> {
  return (await apiPartyOutstandingDetail(page, partyId)).outstanding
}

/** Rewrites a payment's allocations (PUT /payments/:id/allocations). */
export async function apiUpdateAllocationsResponse(
  page: Page,
  paymentId: string,
  allocations: PaymentAllocationInput[],
) {
  return csrfRequest(page, 'put', `${API}/payments/${paymentId}/allocations`, { allocations })
}
