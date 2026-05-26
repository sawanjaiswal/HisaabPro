import * as Sentry from '@sentry/node'

// Razorpay ID prefixes: order_*, pay_*, sub_*, plan_*, cust_*, rzp_*, inv_*, qr_*.
const RZP_ID_RE = /^(order|pay|sub|plan|cust|rzp|inv|qr)_[A-Za-z0-9]{6,}$/
const RZP_KEY_RE = /razorpay|rzp/i

function scrubRazorpayIds(node: unknown, depth = 0): void {
  if (!node || typeof node !== 'object' || depth > 6) return
  if (Array.isArray(node)) {
    for (const item of node) scrubRazorpayIds(item, depth + 1)
    return
  }
  const obj = node as Record<string, unknown>
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (typeof v === 'string') {
      if (RZP_ID_RE.test(v) || (RZP_KEY_RE.test(k) && v.length > 6)) {
        obj[k] = '[redacted-razorpay]'
      }
    } else if (v && typeof v === 'object') {
      scrubRazorpayIds(v, depth + 1)
    }
  }
}

export function initSentry() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Scrub PII / payment-provider identifiers
      if (event.request?.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
        delete event.request.headers['x-razorpay-signature']
        delete event.request.headers['x-razorpay-event-id']
      }
      scrubRazorpayIds(event.request?.data)
      scrubRazorpayIds(event.extra)
      scrubRazorpayIds(event.contexts)
      return event
    },
  })
}

export { Sentry }
