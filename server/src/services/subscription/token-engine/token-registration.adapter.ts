/**
 * Registration-mode adapter seam.
 */

import { TOKEN_BILLING_CONFIG, type TokenRegistrationMode } from '../../../config/token-billing.js'
import type { TokenRegistrationClientPayload } from './token-engine.types.js'
import { registerViaCheckoutOrder } from './token-registration.checkout-order.js'
import { registerViaRegLink } from './token-registration.reglink.js'

export interface TokenRegistrationRequest {
  businessId: string
  userId: string
  mandateRegistrationId: string
  razorpayCustomerId: string
  maxAmountPaise: number
  expireAtUnix: number
  receipt: string
  customer: { name: string; contact: string; email: string }
}

export type TokenRegistrationAdapter = (
  req: TokenRegistrationRequest,
) => Promise<TokenRegistrationClientPayload>

const ADAPTERS: Record<TokenRegistrationMode, TokenRegistrationAdapter> = {
  checkout_order: registerViaCheckoutOrder,
  reglink: registerViaRegLink,
  s2s_intent: () => {
    throw new Error('s2s_intent registration is not enabled on this account. Use checkout_order or reglink.')
  },
}

export function getRegistrationAdapter(): TokenRegistrationAdapter {
  return ADAPTERS[TOKEN_BILLING_CONFIG.REGISTRATION_MODE]
}
