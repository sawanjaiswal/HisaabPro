/**
 * Admin Settings Routes
 * GET  /api/admin/settings         — all settings
 * PUT  /api/admin/settings/:key    — SUPER_ADMIN only
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { requireAdmin, requireSuperAdmin, auditAdminAction } from '../../middleware/admin-auth.js'
import { updatePlatformSettingSchema } from '../../schemas/admin.schemas.js'
import { getAllSettings, updateSetting } from '../../services/admin/index.js'
import { sendSuccess } from '../../lib/response.js'

const router = Router()

// All settings routes require admin auth
router.use(requireAdmin)

// --------------------------------------------------------------------------
// GET / — list all settings
// --------------------------------------------------------------------------

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = getAllSettings()
    sendSuccess(res, settings)
  })
)

// --------------------------------------------------------------------------
// PUT /:key — update a setting (SUPER_ADMIN only)
// --------------------------------------------------------------------------

router.put(
  '/:key',
  requireSuperAdmin,
  validate(updatePlatformSettingSchema),
  asyncHandler(async (req, res) => {
    const key = req.params['key'] as string
    const { value } = req.body as { value: string }
    const result = updateSetting(key, value, req.admin!.email)
    await auditAdminAction(req, 'UPDATE_SETTING', 'SETTINGS', key, { value })
    sendSuccess(res, result)
  })
)

export default router
