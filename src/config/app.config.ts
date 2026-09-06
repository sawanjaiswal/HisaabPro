/** Single source of truth for app-wide constants */

export const APP_NAME = 'HisaabPro' as const

/** Two-tone brand wordmark: base ("Hisaab") + green accent ("Pro").
 * Derived from APP_NAME so the name stays a single source of truth. */
export const APP_NAME_MARK = {
  base: APP_NAME.slice(0, -3),
  accent: APP_NAME.slice(-3),
} as const
export const APP_TAGLINE = 'Billing, Inventory & Payments for Indian Businesses' as const
export const APP_DOMAIN = 'hisaabpro.in' as const
export const APP_VERSION = '1.0.7' as const

export const API_URL = import.meta.env.VITE_API_URL || '/api'
export const APP_ENV = import.meta.env.VITE_APP_ENV || 'development'
export const IS_DEV = APP_ENV === 'development'

/**
 * Auth mode — controls login flow.
 *
 * 'otp'       → phone number + OTP. The real flow, and the default.
 * 'dev-login' → username/password against `/api/auth/dev-login`, a route the
 *               server serves only when `ALLOW_DEV_LOGIN=true`. Opt-in, and
 *               only outside production.
 */
export type AuthMode = 'dev-login' | 'otp'

/**
 * Resolves the login flow from what the build declared.
 *
 * Unset means OTP, never dev-login: an env var missing from `.env.production`
 * used to point the sign-in form at a route production refuses, so nobody could
 * log in at all. A default that only works in dev is a default that breaks the
 * build it is not watching. `dev-login` in a production build is likewise
 * treated as a misconfiguration rather than honoured.
 */
export function resolveAuthMode(declared: string | undefined, appEnv: string): AuthMode {
  if (declared === 'dev-login') return appEnv === 'production' ? 'otp' : 'dev-login'
  return 'otp'
}

export const AUTH_MODE: AuthMode = resolveAuthMode(import.meta.env.VITE_AUTH_MODE, APP_ENV)

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

/** Theme color for mobile browsers (meta tag + PWA) */
export const THEME_COLOR = '#0f3638' as const

/** Timeouts */
export const TIMEOUTS = {
  fetchMs: 10_000,
  /** Auth endpoints on dedicated server */
  authMs: 10_000,
  debounceMs: 300,
  toastMs: 4_000,
  retryDelayMs: [1_000, 3_000],
} as const
