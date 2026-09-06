/**
 * checkout_order registration adapter.
 */

import { createTokenRegistrationOrder } from './razorpay-token.client.js'
import { AUTH_AMOUNT_PAISE } from './token-engine.constants.js'
import type { TokenRegistrationAdapter } from './token-registration.adapter.js'

export const registerViaCheckoutOrder: TokenRegistrationAdapter = async (req) => {
  const order = await createTokenRegistrationOrder({
    amountPaise: AUTH_AMOUNT_PAISE,
    customerId: req.razorpayCustomerId,
    receipt: req.receipt,
    maxAmountPaise: req.maxAmountPaise,
    expireAtUnix: req.expireAtUnix,
    description: 'HisaabPro UPI Autopay mandate (Rs 1 authorization)',
    notes: {
      businessId: req.businessId,
      userId: req.userId,
      mandateRegistrationId: req.mandateRegistrationId,
    },
  })

  return {
    mode: 'checkout_order',
    orderId: order.id,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? '',
    customerId: req.razorpayCustomerId,
    authAmountPaise: AUTH_AMOUNT_PAISE,
  }
}
