/**
 * Razorpay Payment Links — thin HTTP client wrapper.
 *
 * Stubs deterministic fake responses when RAZORPAY_KEY_ID is not set so the
 * entire code path is exercisable without real credentials.
 */

import logger from '../../lib/logger.js'

const BASE_URL = 'https://api.razorpay.com/v1/payment_links'

interface RazorpayLinkPayload {
  amount: number          // paise
  currency?: string
  description?: string
  expire_by?: number      // unix timestamp
  notify?: { sms?: boolean; email?: boolean }
  notes?: Record<string, string>
}

interface RazorpayLinkResponse {
  id: string
  short_url: string
  amount: number
  status: string
  expire_by?: number
}

function credentials(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) return null
  return { keyId, keySecret }
}

function authHeader(keyId: string, keySecret: string): string {
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
}

async function doRequest<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const creds = credentials()
  if (!creds) {
    throw new Error('Razorpay credentials not configured')
  }

  const resp = await fetch(url, {
    method,
    headers: {
      'Authorization': authHeader(creds.keyId, creds.keySecret),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'error',   // maxRedirects: 0 equivalent
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({})) as Record<string, unknown>
    const msg = (err as { error?: { description?: string } }).error?.description ?? resp.statusText
    throw Object.assign(new Error(`Razorpay ${resp.status}: ${msg}`), {
      statusCode: resp.status,
      razorpayCode: (err as { error?: { code?: string } }).error?.code,
    })
  }

  return resp.json() as Promise<T>
}

/** Stub response when no credentials — deterministic for testing */
function stubLink(): RazorpayLinkResponse {
  logger.warn('razorpay.payment_link_client.stub_mode', {
    message: 'RAZORPAY_KEY_ID missing — returning stub link',
  })
  return {
    id: 'plink_test_xxx',
    short_url: 'https://rzp.io/i/abc',
    amount: 0,
    status: 'created',
  }
}

export async function createLink(
  payload: RazorpayLinkPayload,
): Promise<RazorpayLinkResponse> {
  if (!credentials()) return stubLink()
  return doRequest<RazorpayLinkResponse>('POST', BASE_URL, payload)
}

export async function cancelLink(linkId: string): Promise<RazorpayLinkResponse> {
  if (!credentials()) return { ...stubLink(), id: linkId, status: 'cancelled' }
  return doRequest<RazorpayLinkResponse>('POST', `${BASE_URL}/${linkId}/cancel`)
}

export async function getLink(linkId: string): Promise<RazorpayLinkResponse> {
  if (!credentials()) return { ...stubLink(), id: linkId }
  return doRequest<RazorpayLinkResponse>('GET', `${BASE_URL}/${linkId}`)
}
