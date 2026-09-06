/**
 * Token-billing engine types.
 *
 * App-owned recurring billing on Razorpay UPI Autopay S2S tokens.
 */

export const TOKEN_PROVIDER = 'upi_autopay_token' as const

export const TOKEN_MANDATE_STATUSES = [
  'pending',
  'confirmed',
  'paused',
  'cancelled',
  'rejected',
  'expired',
] as const
export type TokenMandateStatus = (typeof TOKEN_MANDATE_STATUSES)[number]

export const MANDATE_STATUS_REASONS = [
  'user_abandoned',
  'ttl_expired',
  'superseded_by_retry',
  'provider_declined',
  'provider_confirmed',
  'user_cancelled',
] as const
export type MandateStatusReason = (typeof MANDATE_STATUS_REASONS)[number]

export const CHARGE_ATTEMPT_STATUSES = [
  'SCHEDULED',
  'CREATED',
  'CAPTURED',
  'FAILED',
  'ABANDONED',
] as const
export type ChargeAttemptStatus = (typeof CHARGE_ATTEMPT_STATUSES)[number]

export type { TokenRegistrationMode } from '../../../config/token-billing.js'

export type TokenRegistrationClientPayload =
  | {
      mode: 'checkout_order'
      orderId: string
      razorpayKeyId: string
      customerId: string
      authAmountPaise: number
    }
  | {
      mode: 'reglink'
      shortUrl: string
    }

export interface RazorpayTokenEntity {
  id: string
  entity: 'token'
  token?: string
  customer_id?: string
  method?: string
  recurring_details?: { status?: string; failure_reason?: string | null }
  vpa?: { username?: string; handle?: string; name?: string | null } | null
  max_amount?: number
  expired_at?: number
  status?: string
  notes?: Record<string, string> | string[]
}

export interface RazorpayAuthLinkResponse {
  id: string
  short_url: string
  customer_id?: string
  order_id?: string
  status?: string
}

export interface RazorpayRecurringPaymentResponse {
  razorpay_payment_id: string
  razorpay_order_id?: string
  razorpay_signature?: string
}

export interface RazorpayCustomerEntity {
  id: string
  entity: 'customer'
  name?: string
  contact?: string | null
  email?: string | null
}

export interface TokenWebhookPaymentEntity {
  id: string
  order_id?: string | null
  token_id?: string | null
  customer_id?: string | null
  status?: string
  amount?: number
  method?: string
  error_description?: string | null
  notes?: Record<string, string> | string[]
}

export interface TokenWebhookTokenEntity {
  id: string
  customer_id?: string | null
  recurring_details?: { status?: string; failure_reason?: string | null }
  max_amount?: number
  expired_at?: number
  vpa?: { username?: string; handle?: string } | null
  notes?: Record<string, string> | string[]
}

export interface ResolvedTokenContext {
  mandate: {
    id: string
    businessId: string
    userId: string | null
    subscriptionId: string
    razorpayCustomerId: string | null
    razorpayTokenId: string | null
    status: string
    maxAmountPaise: number
  }
  attempt: {
    id: string
    businessId: string
    userId: string
    subscriptionId: string
    cycleKey: string
    attemptNo: number
    amountPaise: number
    receiptKey: string
    status: string
  } | null
}
