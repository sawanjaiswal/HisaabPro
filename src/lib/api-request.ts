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
 * CSRF: every state-changing request carries X-CSRF-Token, full stop.
 *
 * The client deliberately keeps NO list of exempt routes. Which paths skip the
 * check is the server's decision alone (CSRF_EXEMPT_AUTH_PATHS in
 * server/src/middleware/csrf.ts), and it short-circuits before validating, so a
 * header sent to an exempt route is simply ignored — harmless. A second copy of
 * that list here would be a source of truth that can drift, and it already did:
 * this function used to skip the whole `/auth/` prefix on the assumption every
 * auth route is unauthenticated. `/auth/logout` and `/auth/switch-business` are
 * not, so both POSTs 403'd forever — logout left the session fully alive while
 * the UI showed a logged-out state. Adding a new authenticated auth route must
 * not require remembering to edit a client list.
 * See .claude/fix-trace-logout-session-survives.md.
 *
 * Cost of always sending it: `getCsrfToken()` memoises the token in-module and
 * de-dupes concurrent fetches (src/lib/api-csrf.ts), so this is at most one
 * extra GET per session — and any user who mutates anything pays it anyway.
 */
export function needsCsrf(method: string): boolean {
  return SYNC_MUTATION_METHODS.has(method)
}

/**
 * Assemble the outgoing headers: content-type, CSRF, replay nonce, optimistic
 * lock, then caller overrides last so a caller can always win.
 */
export async function buildRequestHeaders(opts: {
  method: string
  isFormData: boolean
  entityVersion?: number
  callerHeaders?: HeadersInit
}): Promise<HeadersInit> {
  const { method, isFormData, entityVersion, callerHeaders } = opts

  const csrf = needsCsrf(method) ? await getCsrfToken() : null

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
