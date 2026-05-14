/**
 * Zod validators for the Party Invite-Claim Portal (Epic C PR5 #131).
 *
 * All schemas use .strict() — no unknown keys may pass (security E1).
 * Discriminated union on ClaimBodySchema ensures the service sees an
 * explicit `kind` field, never an ambiguous payload.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Preview params
// ---------------------------------------------------------------------------

/** :token param from GET /api/p/invite/:token */
export const inviteTokenParamSchema = z.object({
  token: z.string().min(16).max(128),
}).strict()

// ---------------------------------------------------------------------------
// OTP send / verify
// ---------------------------------------------------------------------------

/**
 * POST /api/p/invite/:token/otp/send
 * No body required — phone is derived from the Party row behind the link.
 */
export const inviteOtpSendBodySchema = z.object({}).strict()

export type InviteOtpSendBody = z.infer<typeof inviteOtpSendBodySchema>

/**
 * POST /api/p/invite/:token/otp/verify
 */
export const inviteOtpVerifyBodySchema = z.object({
  code: z
    .string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d{6}$/, 'OTP must be numeric'),
}).strict()

export type InviteOtpVerifyBody = z.infer<typeof inviteOtpVerifyBodySchema>

// ---------------------------------------------------------------------------
// Claim body — discriminated union
// ---------------------------------------------------------------------------

const claimNewUserSchema = z.object({
  kind: z.literal('signup'),
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password too long'),
}).strict()

const claimExistingUserSchema = z.object({
  kind: z.literal('existing'),
  /**
   * Short-lived JWT minted by POST /api/p/invite/:token/otp/verify.
   * Scoped to { purpose: 'invite-claim', tokenHash, phone } — 5-min TTL.
   * The claim handler verifies this before running any DB mutation.
   */
  otpVerifiedToken: z.string().min(1, 'OTP verified token is required'),
}).strict()

export const claimBodySchema = z.discriminatedUnion('kind', [
  claimNewUserSchema,
  claimExistingUserSchema,
])

export type ClaimBody = z.infer<typeof claimBodySchema>
export type ClaimNewUserBody = z.infer<typeof claimNewUserSchema>
export type ClaimExistingUserBody = z.infer<typeof claimExistingUserSchema>
