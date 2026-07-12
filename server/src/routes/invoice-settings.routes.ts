/**
 * Invoice Settings Routes — /api/invoice-settings (singleton per business).
 *
 * GET upserts defaults on first read. PUT is a full replace, gated by
 * requirePermission('settings.modify') + userMutationLimiter. Behind the same
 * INVOICE_TEMPLATES feature flag as the templates router.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { userMutationLimiter } from '../middleware/rate-limit/index.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { FEATURES } from '../config/features.js'
import { updateInvoiceSettingsSchema } from '../schemas/invoice-settings.schema.js'
import * as settings from '../services/invoice-settings.service.js'

const router = Router()

router.use(auth)

router.use((_req, res, next) => {
  if (!FEATURES.INVOICE_TEMPLATES.enabled) {
    sendError(res, 'Not found.', 'NOT_FOUND', 404)
    return
  }
  next()
})

/** GET /api/invoice-settings — upsert-on-read defaults. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await settings.getInvoiceSettings(req.user!.businessId)
    sendSuccess(res, data)
  }),
)

/** PUT /api/invoice-settings — full replace. */
router.put(
  '/',
  requirePermission('settings.modify'),
  userMutationLimiter,
  validate(updateInvoiceSettingsSchema),
  asyncHandler(async (req, res) => {
    const data = await settings.updateInvoiceSettings(
      req.user!.businessId,
      req.user!.userId,
      req.body,
    )
    sendSuccess(res, data)
  }),
)

export default router
