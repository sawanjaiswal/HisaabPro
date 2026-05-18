/**
 * pin-gate.types.ts — shared types for the PIN-gate feature.
 *
 * Kept tiny on purpose: the provider holds state internal to its own module;
 * the only types crossing module boundaries are the wire-level route class
 * (string union, matches BE pin-grace-cookie.RouteClass) and the
 * PendingPinChallenge shape that the provider holds while the sheet is open.
 */

/**
 * Wire-level PIN route classes — must match the server's RouteClass union in
 * `server/src/services/security-pin/pin-grace-cookie.ts`.
 *
 *   - 'auth'      → re-auth window (5 min) for sensitive auth-shaped actions.
 *   - 'mutation'  → standard 5-min grace for write operations (default).
 *   - 'finalize'  → tightest window for irreversible actions (payroll finalize).
 *
 * The server includes the routeClass in its 403 PIN_REQUIRED response so the
 * sheet can pick the appropriate title/copy.
 */
export type PinRouteClass = 'auth' | 'mutation' | 'finalize'

/**
 * State carried by the provider while the sheet is open. The `retry` thunk
 * resolves/rejects the outer promise the api.ts caller is awaiting.
 */
export interface PendingPinChallenge {
  routeClass: PinRouteClass
  retry: () => Promise<void>
  cancel: () => void
}
