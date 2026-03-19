/** Single source of truth for app-wide constants */

export const APP_NAME = 'HisaabPro' as const
export const APP_TAGLINE = 'Billing, Inventory & Payments for Indian Businesses' as const
export const APP_DOMAIN = 'hisaabpro.in' as const
export const APP_VERSION = '0.1.0' as const

export const API_URL = import.meta.env.VITE_API_URL || '/api'
export const APP_ENV = import.meta.env.VITE_APP_ENV || 'development'
export const IS_DEV = APP_ENV === 'development'

/**
 * Auth mode — controls login flow.
 *
 * 'dev-login' → username/password (dev credentials: admin/admin123, demo/demo123)
 * 'otp'       → phone number + OTP (production flow, needs MSG91 credentials)
 *
 * To enable OTP for production:
 *   1. Set VITE_AUTH_MODE=otp in .env
 *   2. Uncomment OTP routes in server/src/routes/auth.ts (lines 94-142)
 *   3. Uncomment sendOtp/verifyOtp in src/lib/auth.ts (lines 68-85)
 *   4. Configure MSG91_AUTH_KEY + MSG91_TEMPLATE_ID in server/.env
 */
export type AuthMode = 'dev-login' | 'otp'
export const AUTH_MODE: AuthMode = (import.meta.env.VITE_AUTH_MODE as AuthMode) || 'dev-login'

/** Currency config — all amounts stored in paise (integer) */
export const CURRENCY = {
  code: 'INR',
  symbol: '\u20B9',
  locale: 'en-IN',
  decimals: 2,
} as const

/** Pagination defaults */
export const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 200,
} as const

/** Timeouts */
export const TIMEOUTS = {
  fetchMs: 10_000,
  debounceMs: 300,
  toastMs: 4_000,
  retryDelayMs: [1_000, 3_000],
} as const
