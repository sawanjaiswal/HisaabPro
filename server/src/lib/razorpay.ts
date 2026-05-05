/**
 * Razorpay utility — signature verification for payment-link webhooks.
 *
 * Separate from razorpay.service.ts (subscription billing) to keep concerns
 * isolated and avoid coupling payment-link logic to subscription flows.
 */

import crypto from 'node:crypto'
import logger from './logger.js'

/**
 * Verify Razorpay HMAC-SHA256 webhook signature.
 *
 * SECURITY: uses timingSafeEqual to prevent timing side-channels.
 * Uses raw body bytes as received — never re-stringified JSON.
 *
 * @param rawBody  Raw Buffer from express.raw() middleware
 * @param signature  Value from X-Razorpay-Signature header
 * @param secret  RAZORPAY_WEBHOOK_SECRET env value
 * @returns true if valid
 */
export function verifyRazorpaySignature(
  rawBody: Buffer | string,
  signature: string,
  secret: string,
): boolean {
  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8')

  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex'),
    )
  } catch {
    // timingSafeEqual throws if buffers differ in length — treat as invalid
    logger.warn('razorpay.signature_length_mismatch', { sigLen: signature.length })
    return false
  }
}

/** Read webhook secret from env; return null if unconfigured (stub mode). */
export function getWebhookSecret(): string | null {
  return process.env.RAZORPAY_WEBHOOK_SECRET ?? null
}
