/**
 * reglink registration adapter.
 */

import { createAuthLink } from './razorpay-token.client.js'
import { AUTH_AMOUNT_PAISE, REGLINK_ALLOWED_HOSTS } from './token-engine.constants.js'
import type { TokenRegistrationAdapter } from './token-registration.adapter.js'

function assertAllowedHost(shortUrl: string): void {
  let host: string
  try {
    host = new URL(shortUrl).hostname.toLowerCase()
  } catch {
    throw new Error(`reglink short_url is not a valid URL: ${shortUrl}`)
  }
  const ok = REGLINK_ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  if (!ok) {
    throw new Error(`reglink short_url host "${host}" is not an allowed Razorpay host`)
  }
}

export const registerViaRegLink: TokenRegistrationAdapter = async (req) => {
  const link = await createAuthLink({
    customer: req.customer,
    amountPaise: AUTH_AMOUNT_PAISE,
    maxAmountPaise: req.maxAmountPaise,
    expireAtUnix: req.expireAtUnix,
    description: 'HisaabPro UPI Autopay mandate (Rs 1 authorization)',
    receipt: req.receipt,
    notes: {
      businessId: req.businessId,
      userId: req.userId,
      mandateRegistrationId: req.mandateRegistrationId,
    },
  })

  assertAllowedHost(link.short_url)
  return { mode: 'reglink', shortUrl: link.short_url }
}
