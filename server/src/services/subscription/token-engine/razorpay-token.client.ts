/**
 * Razorpay S2S token-billing HTTP client.
 *
 * Direct S2S REST calls for token recurring operations:
 * - Orders with token block (for UPI Autopay / Card tokens)
 * - /subscription_registration/auth_links
 * - /payments/create/recurring
 * - /customers
 * - /orders (exact receipt queries)
 */

import type {
  RazorpayAuthLinkResponse,
  RazorpayCustomerEntity,
  RazorpayRecurringPaymentResponse,
  RazorpayTokenEntity,
} from './token-engine.types.js'

const RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1'
const API_TIMEOUT_MS = 10_000

export class RazorpayTokenApiError extends Error {
  override readonly name = 'RazorpayTokenApiError'
  constructor(
    public readonly httpStatus: number,
    public readonly path: string,
    public readonly providerCode: string | null,
    public readonly providerDescription: string | null,
  ) {
    super(`Razorpay ${path} -> HTTP ${httpStatus}: ${providerCode ?? 'unknown'} ${providerDescription ?? ''}`)
  }
}

export class RazorpayTokenTransportError extends Error {
  override readonly name = 'RazorpayTokenTransportError'
  constructor(public readonly path: string, cause: unknown) {
    super(`Razorpay ${path} transport failure: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

function getCredentials() {
  const key_id = process.env.RAZORPAY_KEY_ID
  const key_secret = process.env.RAZORPAY_KEY_SECRET
  if (!key_id || !key_secret) {
    throw new Error('Razorpay credentials not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)')
  }
  return { key_id, key_secret }
}

async function rzp<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const { key_id, key_secret } = getCredentials()
  let res: Response
  try {
    res = await fetch(`${RAZORPAY_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${key_id}:${key_secret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    })
  } catch (e) {
    throw new RazorpayTokenTransportError(path, e)
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (e) {
    if (res.ok) throw new RazorpayTokenTransportError(path, e)
    json = {}
  }

  if (!res.ok) {
    const err = (json as { error?: { code?: string; description?: string } }).error
    throw new RazorpayTokenApiError(res.status, path, err?.code ?? null, err?.description ?? null)
  }
  return json as T
}

export interface TokenOrderParams {
  amountPaise: number
  customerId: string
  receipt: string
  maxAmountPaise: number
  expireAtUnix: number
  description: string
  notes: Record<string, string>
}

export function createTokenRegistrationOrder(p: TokenOrderParams) {
  return rzp<{ id: string; status: string }>('POST', '/orders', {
    amount: p.amountPaise,
    currency: 'INR',
    method: 'upi',
    customer_id: p.customerId,
    receipt: p.receipt,
    token: {
      max_amount: p.maxAmountPaise,
      expire_at: p.expireAtUnix,
      frequency: 'as_presented',
    },
    description: p.description,
    notes: p.notes,
  })
}

export function createAuthLink(p: {
  customer: { name: string; contact: string; email: string }
  amountPaise: number
  maxAmountPaise: number
  expireAtUnix: number
  description: string
  receipt: string
  notes: Record<string, string>
}) {
  return rzp<RazorpayAuthLinkResponse>('POST', '/subscription_registration/auth_links', {
    customer: p.customer,
    type: 'link',
    amount: p.amountPaise,
    currency: 'INR',
    description: p.description,
    subscription_registration: {
      method: 'upi',
      max_amount: p.maxAmountPaise,
      expire_at: p.expireAtUnix,
      frequency: 'as_presented',
    },
    receipt: p.receipt,
    notes: p.notes,
    email_notify: 0,
    sms_notify: 0,
  })
}

export function createDebitOrder(p: {
  amountPaise: number
  receipt: string
  notes: Record<string, string>
}) {
  return rzp<{ id: string; status: string }>('POST', '/orders', {
    amount: p.amountPaise,
    currency: 'INR',
    payment_capture: true,
    receipt: p.receipt,
    notes: p.notes,
  })
}

export function createRecurringPayment(p: {
  amountPaise: number
  orderId: string
  customerId: string
  tokenId: string
  email: string
  contact: string
  description: string
  notes: Record<string, string>
}) {
  return rzp<RazorpayRecurringPaymentResponse>('POST', '/payments/create/recurring', {
    email: p.email,
    contact: p.contact,
    amount: p.amountPaise,
    currency: 'INR',
    order_id: p.orderId,
    customer_id: p.customerId,
    token: p.tokenId,
    recurring: '1',
    description: p.description,
    notes: p.notes,
  })
}

export function createCustomer(p: { name: string; contact: string; email: string }) {
  return rzp<RazorpayCustomerEntity>('POST', '/customers', { ...p, fail_existing: '0' })
}

export function fetchCustomerTokens(customerId: string) {
  return rzp<{ items?: RazorpayTokenEntity[] }>('GET', `/customers/${customerId}/tokens`)
}

export function deleteCustomerToken(customerId: string, tokenId: string) {
  return rzp<{ deleted?: boolean }>('DELETE', `/customers/${customerId}/tokens/${tokenId}`)
}

export function fetchOrdersByReceipt(receipt: string) {
  return rzp<{ count: number; items: Array<{ id: string; status: string; receipt: string | null }> }>(
    'GET',
    `/orders?receipt=${encodeURIComponent(receipt)}`,
  )
}

export function fetchOrderPayments(orderId: string) {
  return rzp<{ count: number; items: Array<{ id: string; status: string; amount: number; token_id?: string | null; error_description?: string | null }> }>(
    'GET',
    `/orders/${orderId}/payments`,
  )
}
