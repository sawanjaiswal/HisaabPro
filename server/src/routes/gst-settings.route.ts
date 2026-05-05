/**
 * GST Settings Routes — /api/gst/settings
 *
 * GET  /api/gst/settings  — return all 7 GST fields for the active business
 * PATCH /api/gst/settings — update GST fields; auto-flips gstEnabled on GSTIN save
 *
 * businessId is always taken from session (req.user.businessId), never from body.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { validate } from '../middleware/validate.js'
import { idempotencyCheck } from '../middleware/idempotency.js'
import { sendSuccess } from '../lib/response.js'
import { patchGstSettingsSchema } from '../middleware/validate-gst-settings.js'
import * as gstSettingsService from '../services/gst-settings.service.js'

const router = Router()

router.use(auth)

/**
 * GET /api/gst/settings
 * Returns all 7 GST configuration fields for the session's active business.
 * Requires: settings.view permission
 */
router.get(
  '/',
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const data = await gstSettingsService.getGstSettings(businessId)
    sendSuccess(res, { settings: data })
  }),
)

/**
 * PATCH /api/gst/settings
 * Partial update of GST configuration. Auto-flips gstEnabled=true when GSTIN saved.
 * Writes AuditLog row with GSTIN masked to suffix-4 (Security MB-4).
 * Idempotency: latest-write-wins — single-tenant owner race is benign.
 * Requires: settings.modify permission
 */
router.patch(
  '/',
  requirePermission('settings.modify'),
  idempotencyCheck(),
  validate(patchGstSettingsSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const data = await gstSettingsService.updateGstSettings(businessId, req.body, userId)
    sendSuccess(res, { settings: data })
  }),
)

export default router
