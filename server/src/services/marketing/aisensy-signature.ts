/**
 * Aisensy Webhook Signature — HMAC-SHA256 (PR6)
 * timingSafeEqual with try/catch on length mismatch.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyAisensySignature(
  rawBody: Buffer,
  sigHeader: string,
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(
      Buffer.from(sigHeader.toLowerCase(), 'hex'),
      Buffer.from(expected, 'hex'),
    )
  } catch {
    // length mismatch or invalid hex — not equal
    return false
  }
}
