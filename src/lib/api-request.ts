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

/**
 * CSRF: mutations require X-CSRF-Token matching the csrf-token cookie.
 * Auth endpoints are exempt server-side, so skip the token roundtrip for them.
 */
export function needsCsrf(method: string, path: string): boolean {
  return SYNC_MUTATION_METHODS.has(method) && !path.startsWith('/auth/')
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
