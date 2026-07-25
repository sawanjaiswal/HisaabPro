/**
 * Outgoing-request helpers for `api()` — header assembly and the
 * refresh-eligibility rule.
 *
 * Split out of `api.ts` so that file reads as the request lifecycle
 * (send → intercept → parse) rather than header bookkeeping.
 */

import { SYNC_MUTATION_METHODS } from './offline.constants'
import { getCsrfToken } from './api-csrf'

// Endpoints where a 401 means "these credentials/tokens are invalid," not
// "the access token merely expired" — attempting a refresh here would either
// recurse (refresh calling itself) or mask a genuine auth failure as a retry.
// Every other path (including /auth/me, /auth/logout, /auth/switch-business)
// goes through the normal refresh-and-retry interceptor.
const NON_REFRESHABLE_AUTH_PATHS = [
  '/auth/login',
  '/auth/dev-login',
  '/auth/refresh',
  '/auth/register',
  '/auth/verify-registration',
  '/auth/verify-otp',
]

export function isNonRefreshableAuthPath(path: string): boolean {
  return NON_REFRESHABLE_AUTH_PATHS.some((p) => path.startsWith(p))
}

// The auth routes the SERVER exempts from CSRF — all of them unauthenticated,
// so no session cookie (and therefore no csrf cookie) exists yet. Mirrors
// CSRF_EXEMPT_AUTH_PATHS in server/src/middleware/csrf.ts, minus the `/api`
// mount prefix. Kept as an explicit list, NOT an `/auth/` prefix test: the
// prefix silently exempted `/auth/logout` and `/auth/switch-business` too, and
// those two are authenticated — the server requires the header, so both POSTs
// 403'd. Logout in particular left the session fully alive while the UI showed
// a logged-out state. See .claude/fix-trace-logout-session-survives.md.
const CSRF_EXEMPT_AUTH_PATHS = new Set([
  '/auth/csrf-token',
  '/auth/send-otp',
  '/auth/verify-otp',
  '/auth/dev-login',
  '/auth/refresh',
  '/auth/login',
  '/auth/register',
  '/auth/verify-registration',
  '/auth/resend-otp',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/biometric/register',
  '/auth/biometric/authenticate',
  '/auth/biometric/challenge',
])

/**
 * CSRF: mutations require X-CSRF-Token matching the csrf-token cookie, except
 * on the unauthenticated auth routes the server exempts.
 */
export function needsCsrf(method: string, path: string): boolean {
  return SYNC_MUTATION_METHODS.has(method) && !CSRF_EXEMPT_AUTH_PATHS.has(path)
}

/**
 * Assemble the outgoing headers: content-type, CSRF, replay nonce, optimistic
 * lock, then caller overrides last so a caller can always win.
 */
export async function buildRequestHeaders(opts: {
  method: string
  path: string
  isFormData: boolean
  entityVersion?: number
  callerHeaders?: HeadersInit
}): Promise<HeadersInit> {
  const { method, path, isFormData, entityVersion, callerHeaders } = opts

  const csrf = needsCsrf(method, path) ? await getCsrfToken() : null

  // Replay protection: the replayProtection middleware demands a fresh nonce +
  // timestamp on every mutation — send them so services never have to remember.
  const replayHeaders: Record<string, string> = SYNC_MUTATION_METHODS.has(method)
    ? {
        'X-Request-Nonce': crypto.randomUUID(),
        'X-Request-Timestamp': Date.now().toString(),
      }
    : {}

  return {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    ...replayHeaders,
    ...(entityVersion !== undefined ? { 'X-Entity-Version': String(entityVersion) } : {}), // #150 optimistic lock
    ...callerHeaders,
  }
}
