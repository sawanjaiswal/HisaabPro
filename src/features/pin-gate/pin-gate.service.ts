/**
 * pin-gate.service.ts — thin wrapper around POST /api/auth/pin/verify.
 *
 * The server endpoint (server/src/routes/auth-pin.routes.ts):
 *   - 200 + Set-Cookie pin_gate_grace  → PIN accepted.
 *   - 401 UNAUTHORIZED  details.reason='INVALID_PIN' → wrong PIN.
 *   - 429 RATE_LIMITED  details.retryAfter=<sec>     → locked out.
 *
 * The `_skipPin: true` flag is critical: without it, the api.ts interceptor
 * would catch this very call's 401/429 path and recurse forever trying to
 * open the sheet from inside the sheet's own submit handler.
 *
 * Note: even though /auth/pin/verify is auth-shaped, we still pass
 * entityType + entityLabel so any future offline queue surfacing this in a
 * UI shows a useful label instead of "Offline change" (per OFFLINE_RULES
 * rule 2). It will not actually queue because `oq` defaults to true only
 * for non-/auth/ paths — but the metadata is harmless and forward-compatible.
 */

import { api } from '@/lib/api'

export interface VerifyPinResult {
  success: true
}

/**
 * Verify the user's PIN. On success the server sets the pin_gate_grace
 * cookie on the response — no client-side state to manage. Throws an
 * ApiError on failure; the sheet inspects the .code/.status to render the
 * appropriate error copy.
 */
export async function verifyPin(pin: string): Promise<VerifyPinResult> {
  return api<VerifyPinResult>('/auth/pin/verify', {
    method: 'POST',
    body: JSON.stringify({ pin }),
    _skipPin: true,
    entityType: 'pin',
    entityLabel: 'PIN verification',
  })
}

/**
 * Request a PIN reset OTP. Sent to the JWT user's phone server-side; the
 * client never supplies the destination. Always resolves with `{ sent: true }`
 * unless transport fails.
 */
export interface RequestPinResetResult {
  sent: true
  message?: string
}

export async function requestPinReset(): Promise<RequestPinResetResult> {
  return api<RequestPinResetResult>('/auth/pin/reset/request', {
    method: 'POST',
    body: JSON.stringify({}),
    _skipPin: true,
    entityType: 'pin',
    entityLabel: 'PIN reset',
  })
}
