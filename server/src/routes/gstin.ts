/**
 * GSTIN Routes — format validation and verification
 * All routes require auth.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { sendSuccess } from '../lib/response.js'
import { verifyGstinSchema } from '../schemas/tax.schemas.js'
import { validateGstin, extractStateCode } from '../services/gstin.utils.js'

const router = Router()

router.use(auth)

// ─── Local format validation ──────────────────────────────────────────────────

/**
 * POST /api/gstin/validate
 * Local regex + checksum validation only. Fast, no external calls.
 * Returns { valid, stateCode, error? }
 */
router.post(
  '/validate',
  requirePermission('settings.view'),
  validate(verifyGstinSchema),
  asyncHandler(async (req, res) => {
    const result = validateGstin(req.body.gstin)
    sendSuccess(res, result)
  })
)

// ─── Government API verification (stub) ──────────────────────────────────────

/**
 * POST /api/gstin/verify
 * Local validation + stub for government IRP API verification.
 * TODO: Integrate with GST Suvidha Provider (GSP) API for real-time verification.
 *       Requires GSP credentials (client_id, client_secret, otp-based auth).
 *       Reference: https://developer.gst.gov.in/apiportal/taxpayer/search
 */
router.post(
  '/verify',
  requirePermission('settings.view'),
  validate(verifyGstinSchema),
  asyncHandler(async (req, res) => {
    const localResult = validateGstin(req.body.gstin)

    if (!localResult.valid) {
      sendSuccess(res, {
        valid: false,
        verified: false,
        stateCode: null,
        error: localResult.error,
      })
      return
    }

    const stateCode = extractStateCode(req.body.gstin)

    // TODO: Replace mock with real GSP API call when credentials available.
    // Real response would include: legalName, tradeName, registrationDate, type, status
    sendSuccess(res, {
      valid: true,
      verified: true,         // mock — will be actual portal response once GSP is integrated
      stateCode,
      legalName: 'Verified Business',
      status: 'Active',
      type: 'Regular',
    })
  })
)

export default router
