/**
 * PIN-auth Zod schemas — Phase 6 PR3.
 *
 * Three endpoints under `/api/auth/pin`:
 *   POST /verify         — bare PIN check; success issues pin_gate_grace cookie.
 *   POST /reset/request  — start OTP-gated reset flow (sends OTP to user's phone).
 *   POST /reset/confirm  — supply OTP + new PIN; rotates pinHash + clears lockout.
 *
 * Hindi-safe: `\d` matches ASCII 0-9 only — Devanagari numerals (०-९) are
 * intentionally rejected. PIN length 4-6 mirrors `Settings.pinHash` schema
 * constraint (PR1A migration).
 *
 * All schemas use `.strict()` to reject unknown keys — defense against
 * accidental field-injection where a client sends `{ pin, userId: 'other' }`
 * hoping to override the JWT-derived userId.
 */

import { z } from 'zod'
import { PIN_REGEX } from '../constants/pin-auth.constants.js'

/** POST /api/auth/pin/verify */
export const verifyPinSchema = z
  .object({
    pin: z
      .string()
      .regex(PIN_REGEX, 'PIN must be 4-6 digits'),
  })
  .strict()
export type VerifyPinInput = z.infer<typeof verifyPinSchema>

/** POST /api/auth/pin/reset/request — no body fields needed (phone comes from JWT). */
export const resetRequestSchema = z.object({}).strict()
export type ResetRequestInput = z.infer<typeof resetRequestSchema>

/** POST /api/auth/pin/reset/confirm */
export const resetConfirmSchema = z
  .object({
    otp: z
      .string()
      .regex(/^\d{4,6}$/, 'OTP must be 4-6 digits'),
    newPin: z
      .string()
      .regex(PIN_REGEX, 'PIN must be 4-6 digits'),
  })
  .strict()
export type ResetConfirmInput = z.infer<typeof resetConfirmSchema>
