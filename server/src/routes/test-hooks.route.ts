/**
 * Test-only routes for E2E automation. See `lib/test-hooks.ts` for the guard.
 *
 * This router is only mounted when `testHooksEnabled()` is true at boot
 * (app.routes.ts), AND every handler re-checks the guard at request time so a
 * mid-process env change cannot leave it live. Unauthenticated by design — it
 * exposes nothing but OTPs the caller could already trigger, and only ever on a
 * non-production process that was explicitly started with E2E_TEST_HOOKS=1.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { sendSuccess } from '../lib/response.js'
import { notFoundError, validationError } from '../lib/errors.js'
import { testHooksEnabled, readLastOtp, clearOtpBuffer } from '../lib/test-hooks.js'

const router = Router()

/** Fail closed on every request, not just at mount. */
router.use((_req, _res, next) => {
  if (!testHooksEnabled()) return next(notFoundError('Not found'))
  next()
})

/** GET /api/__test__/health — proves hooks are live before a suite starts. */
router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, { testHooks: true })
  })
)

/** GET /api/__test__/last-otp?phone=9876543210 — the plaintext OTP just sent. */
router.get(
  '/last-otp',
  asyncHandler(async (req, res) => {
    const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : ''
    if (!/^\d{10}$/.test(phone)) throw validationError('phone must be 10 digits')

    const record = readLastOtp(phone)
    if (!record) throw notFoundError('No OTP issued for that phone in the last 5 minutes')

    sendSuccess(res, { phone: record.phone, otp: record.otp, issuedAt: record.at })
  })
)

/** POST /api/__test__/reset-otps — drop the buffer between scenarios. */
router.post(
  '/reset-otps',
  asyncHandler(async (_req, res) => {
    clearOtpBuffer()
    sendSuccess(res, { cleared: true })
  })
)

export default router
