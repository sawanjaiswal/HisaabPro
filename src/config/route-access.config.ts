/** Which routes a session may reach given what it has — access, not addresses. */

import { ROUTES } from './routes.config'

/**
 * Routes a signed-in user with **zero** business memberships may reach.
 *
 * Everything else is business-scoped and answers NO_BUSINESS server-side, so
 * `ProtectedRoute` sends such a user to onboarding instead. The exemptions are
 * the two ways to acquire a business — create your own, or redeem an invite
 * into someone else's — plus onboarding itself (redirect loop) and HOME (which
 * `HomeGate` routes on its own, including the admin host).
 *
 * Declared here, next to the routes, because leaving it as an inline pathname
 * comparison in the guard is how `/join` came to be missing: an invited staff
 * member was redirected to "create your own business", the exact screen the
 * invite exists to bypass. See .claude/fix-trace-join-business-gate.md.
 */
export const NO_BUSINESS_ROUTES: readonly string[] = [
  ROUTES.ONBOARDING,
  ROUTES.HOME,
  ROUTES.JOIN_BUSINESS,
  ROUTES.CREATE_BUSINESS,
]

