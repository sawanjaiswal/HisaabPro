/**
 * Admin Dashboard Routes
 * GET /api/admin/dashboard/overview — platform stats
 * GET /api/admin/dashboard/growth   — signups + activity chart
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { requireAdmin } from '../../middleware/admin-auth.js'
import { dashboardPeriodQuerySchema } from '../../schemas/admin.schemas.js'
import { getPlatformOverview, getGrowthMetrics } from '../../services/admin/index.js'
import { sendSuccess } from '../../lib/response.js'

const router = Router()

// All dashboard routes require admin auth
router.use(requireAdmin)

// --------------------------------------------------------------------------
// GET /overview
// --------------------------------------------------------------------------

router.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const overview = await getPlatformOverview()
    sendSuccess(res, overview)
  })
)

// --------------------------------------------------------------------------
// GET /growth?period=30
// --------------------------------------------------------------------------

router.get(
  '/growth',
  asyncHandler(async (req, res) => {
    const { period } = dashboardPeriodQuerySchema.parse({ period: req.query['period'] })
    const metrics = await getGrowthMetrics(period)
    sendSuccess(res, metrics)
  })
)

export default router
