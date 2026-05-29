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
import { verifyGstinExternal } from '../services/gstin-verify.service.js'

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

// ─── Government API verification (GSP) ───────────────────────────────────────

/**
 * POST /api/gstin/verify
 * Local format/checksum validation + external GSP registry lookup.
 * `verified` is true only when a configured provider confirms an active
 * registration. When GSTIN_VERIFY_API_* is unset the GSTIN can still be
 * format-valid (valid:true) but is not registry-confirmed (verified:false,
 * providerConfigured:false) — we never fabricate a pass.
 * Reference: https://developer.gst.gov.in/apiportal/taxpayer/search
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
        providerConfigured: false,
        stateCode: null,
        error: localResult.error,
      })
      return
    }

    const stateCode = extractStateCode(req.body.gstin)
    const external = await verifyGstinExternal(req.body.gstin)

    sendSuccess(res, {
      valid: true,
      verified: external.verified,
      providerConfigured: external.providerConfigured,
      stateCode,
      legalName: external.legalName,
      tradeName: external.tradeName,
      status: external.status,
      type: external.type,
      registrationDate: external.registrationDate,
      error: external.error,
    })
  })
)

export default router
