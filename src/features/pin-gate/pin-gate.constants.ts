/**
 * pin-gate.constants.ts — non-secret constants for the PIN sheet UI.
 *
 * Mirror of `server/src/constants/pin-auth.constants.ts` for the digits
 * length range — kept duplicated (not imported) because the server module is
 * not part of the FE bundle. Any change to PIN_MIN_LEN / PIN_MAX_LEN must be
 * applied to BOTH files.
 */

import type { PinRouteClass } from './pin-gate.types'

/** Minimum PIN length accepted by the server (`/auth/pin/verify` zod schema). */
export const PIN_MIN_LEN = 4

/** Maximum PIN length accepted by the server (`/auth/pin/verify` zod schema). */
export const PIN_MAX_LEN = 6

/**
 * Keypad layout — 3 columns × 4 rows. Empty string is the placeholder slot
 * (bottom-left) so the layout aligns with a standard PIN pad. The backspace
 * glyph is unicode U+232B, which matches Android's PIN screen — keeps the
 * visual without pulling in another lucide icon.
 */
export const KEYPAD_KEYS: ReadonlyArray<string> = [
  '1', '2', '3',
  '4', '5', '6',
  '7', '8', '9',
  '',  '0', '⌫', // ⌫
] as const

/** Sentinel value for the backspace key — compare against this, not the glyph. */
export const KEYPAD_BACKSPACE = '⌫'

/**
 * Map server `routeClass` → translation key for the sheet title. Falls back
 * to `pinPadTitleMutation` if the server sends an unexpected value.
 */
export const ROUTE_CLASS_TITLE_KEY: Readonly<Record<PinRouteClass, string>> = {
  auth:     'pinPadTitleAuth',
  mutation: 'pinPadTitleMutation',
  finalize: 'pinPadTitleFinalize',
} as const

/**
 * Lockout countdown polling interval (ms). 1s ticks keep the displayed
 * mm:ss accurate without burning CPU.
 */
export const LOCKOUT_TICK_MS = 1000
