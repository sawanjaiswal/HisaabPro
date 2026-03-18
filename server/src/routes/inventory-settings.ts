/**
 * Inventory Settings Routes — Business-level inventory config
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { updateInventorySettingsSchema } from '../schemas/product.schemas.js'
import * as settingsService from '../services/inventory-settings.service.js'

const router = Router()

router.use(auth)

/** GET /api/settings/inventory — Get inventory settings */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const settings = await settingsService.getSettings(businessId)
    sendSuccess(res, settings)
  })
)

/** PUT /api/settings/inventory — Update inventory settings */
router.put(
  '/',
  validate(updateInventorySettingsSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const settings = await settingsService.updateSettings(businessId, req.body)
    sendSuccess(res, settings)
  })
)

export default router
