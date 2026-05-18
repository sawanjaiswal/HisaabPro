/**
 * auth-pin.routes.ts — PIN verify + reset endpoints (Phase 6 PR3).
 *
 * Three endpoints under `/api/auth/pin`:
 *
 *   POST /verify          — 200 on correct PIN (issues pin_gate_grace cookie).
 *                           401 INVALID_PIN on mismatch.
 *                           429 PIN_LOCKED on active lockout window.
 *
 *   POST /reset/request   — sends OTP to the JWT user's phone. Persists a
 *                           PinResetToken row to bind the flow to this session.
 *                           Always 200 (OTP delivery is out-of-band; client
 *                           polls /reset/confirm with the OTP).
 *
 *   POST /reset/confirm   — verifies OTP + sets new PIN + clears lockout.
 *                           401 INVALID_OTP on bad/expired OTP.
 *                           Setting a new pinHash silently invalidates every
 *                           prior pin_gate_grace cookie via pf-mismatch (the
 *                           v2.3 design payoff — no session-table sweep).
 *
 * Auth: ALL three require a valid JWT (no pre-session flow — PIN gating sits
 * on top of an authenticated session). Rate limiting inherits from the global
 * apiRateLimiter mounted in app.ts.
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §18.4 row 79.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { sendSuccess } from '../lib/response.js'
import {
  verifyPinSchema,
  resetRequestSchema,
  resetConfirmSchema,
} from '../schemas/pin.schemas.js'
import { verifyUserPin } from '../services/security-pin/pin-verify.service.js'
import {
  requestPinReset,
  confirmPinReset,
} from '../services/security-pin/pin-reset.service.js'

const router = Router()

// All PIN endpoints require an authenticated session.
router.use(auth)

/**
 * POST /api/auth/pin/verify
 *
 * Body: { pin: string (4-6 digits) }
 * Success: 200 { success: true, data: { success: true } } + Set-Cookie pin_gate_grace
 * Failure: 401 INVALID_PIN | 429 PIN_LOCKED (via AppError → errorHandler)
 */
router.post(
  '/verify',
  validate(verifyPinSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const businessId = req.user!.businessId
    const { pin } = req.body as { pin: string }

    const result = await verifyUserPin({
      userId,
      businessId,
      pin,
      res,
    })
    sendSuccess(res, result)
  }),
)

/**
 * POST /api/auth/pin/reset/request
 *
 * Body: {} (phone is read server-side from req.user).
 * Success: 200 { success: true, data: { sent: true, message } }.
 *
 * Sends OTP via MSG91 (or echoes via logger.debug in dev). Persists an
 * OtpCode row + a PinResetToken row scoped to the JWT user — never trust
 * the client for either the phone or the userId.
 */
router.post(
  '/reset/request',
  validate(resetRequestSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const result = await requestPinReset({ userId })
    sendSuccess(res, result)
  }),
)

/**
 * POST /api/auth/pin/reset/confirm
 *
 * Body: { otp: string (4-6 digits), newPin: string (4-6 digits) }
 * Success: 200 { success: true, data: { success: true } }
 * Failure: 401 INVALID_OTP | 400 VALIDATION_ERROR
 *
 * Side effects on success:
 *   - UserAppSettings.pinHash rotated (silently invalidates all prior grace cookies).
 *   - Lockout cleared (pinAttempts=0, pinLockedUntil=null).
 *   - OtpCode row marked verified; PinResetToken row marked consumed.
 *   - AuditLog row (action='PIN_RESET') written in the same transaction.
 */
router.post(
  '/reset/confirm',
  validate(resetConfirmSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const businessId = req.user!.businessId
    const { otp, newPin } = req.body as { otp: string; newPin: string }

    const result = await confirmPinReset({ userId, businessId, otp, newPin })
    sendSuccess(res, result)
  }),
)

export default router
