/**
 * Dashboard Routes — aggregated business stats
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { resolveBusinessId } from '../lib/business.js'
import { dashboardStatsSchema } from '../schemas/report.schemas.js'
import { getDashboardStats } from '../services/dashboard.service.js'

const router = Router()

router.use(auth)

/** GET /api/dashboard/stats — Get dashboard statistics */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const query = dashboardStatsSchema.parse(req.query)
    const stats = await getDashboardStats(businessId, query)
    sendSuccess(res, stats)
  })
)

export default router
