/**
 * Dashboard Routes — aggregated business stats
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { dashboardStatsSchema } from '../schemas/report.schemas.js'
import { getDashboardStats, getHomeDashboard } from '../services/dashboard/index.js'

const router = Router()

router.use(auth)

/** GET /api/dashboard/home — Single-call home dashboard (no date filter) */
router.get(
  '/home',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const data = await getHomeDashboard(businessId)
    sendSuccess(res, data)
  })
)

/** GET /api/dashboard/stats — Get dashboard statistics (for Reports page) */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = dashboardStatsSchema.parse(req.query)
    const stats = await getDashboardStats(businessId, query)
    sendSuccess(res, stats)
  })
)

export default router
