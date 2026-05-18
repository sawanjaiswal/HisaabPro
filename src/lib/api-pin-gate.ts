/**
 * API PIN-gate handler — module-singleton bridge between api.ts and PinGateProvider.
 *
 * The 403 PIN_REQUIRED interceptor in api.ts needs to:
 *   1. Pause the current request,
 *   2. Open the PinPadSheet (a React component, lives in the tree),
 *   3. Wait for the user to enter their PIN,
 *   4. Retry the original request transparently once the grace cookie is set.
 *
 * The interceptor cannot directly call React hooks. The provider registers a
 * handler at mount; the interceptor calls it. When no provider is mounted
 * (e.g. unauthenticated pages, tests that don't need PIN gating) the
 * interceptor falls through and the caller sees a normal 403 error — no
 * silent hangs.
 *
 * Pattern mirrors `api-csrf.ts`: a tiny module-scoped slot mutated by exactly
 * one consumer at any time. The provider clears the handler on unmount.
 */

import type { PinRouteClass } from '@/features/pin-gate/pin-gate.types'

/**
 * Handler signature: receives a retry-thunk + the route-class string so the
 * sheet can render the appropriate title ("Confirm sensitive change",
 * "Authorize finalize", etc.). Must resolve with the retry result, or reject
 * with an `ApiError('PIN entry cancelled', 'PIN_CANCELLED', 403)` if the user
 * dismisses the sheet.
 */
export type PinGateHandler = <T>(
  retry: () => Promise<T>,
  routeClass: PinRouteClass,
) => Promise<T>

let handler: PinGateHandler | null = null

/**
 * Register or clear the PIN-gate handler. Pass `null` on provider unmount so
 * stale closures over an unmounted React tree are never invoked.
 */
export function setApi403Handler(next: PinGateHandler | null): void {
  handler = next
}

/**
 * Read the current handler. The api.ts interceptor calls this on every 403
 * PIN_REQUIRED response; null means no provider is mounted (caller gets a
 * normal error and renders its own toast/redirect).
 */
export function getApi403Handler(): PinGateHandler | null {
  return handler
}
