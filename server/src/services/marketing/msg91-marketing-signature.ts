/**
 * MSG91 Marketing Webhook Signature — static token compare (PR6)
 * timingSafeEqual with try/catch on length mismatch.
 */

import { timingSafeEqual } from 'node:crypto'

export function verifyMsg91Token(headerToken: string, expectedToken: string): boolean {
  try {
    return timingSafeEqual(
      Buffer.from(headerToken, 'utf8'),
      Buffer.from(expectedToken, 'utf8'),
    )
  } catch {
    return false
  }
}
