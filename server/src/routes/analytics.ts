/**
 * Predictive analytics routes (#146) — read-only sales/stock forecasting.
 * Gated behind the premium `advancedReports` feature flag, mirroring
 * financial-reports.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { requireActiveBusiness } from '../middleware/require-active-business.js'
import { requireFeature } from '../middleware/subscription-gate.js'
import { sendSuccess } from '../lib/response.js'
import { revenueForecastSchema, stockForecastSchema } from '../schemas/analytics.schemas.js'
import { getRevenueForecast, getStockForecast } from '../services/analytics/forecast.service.js'

const router = Router()

router.use(auth)
router.use(requireActiveBusiness)
router.use(requireFeature('advancedReports'))

/** GET /api/analytics/revenue-forecast — monthly revenue trend + projection */
router.get(
  '/revenue-forecast',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = revenueForecastSchema.parse(req.query)
    const result = await getRevenueForecast(businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/analytics/stock-forecast — per-product stock-out projection */
router.get(
  '/stock-forecast',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = stockForecastSchema.parse(req.query)
    const result = await getStockForecast(businessId, query)
    sendSuccess(res, result)
  })
)

export default router
