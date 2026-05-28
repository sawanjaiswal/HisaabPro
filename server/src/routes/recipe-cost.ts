/**
 * Recipe Cost Dashboard routes — read-only cost-per-unit / margin derivation
 * over BOM data (#115). Auth-gated like BOM (NOT premium-gated).
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { requireActiveBusiness } from '../middleware/require-active-business.js'
import { sendSuccess } from '../lib/response.js'
import { recipeCostQuerySchema } from '../schemas/recipe-cost.schemas.js'
import { getRecipeCostSummary } from '../services/recipe-cost/recipe-cost.service.js'

const router = Router()

router.use(auth)
router.use(requireActiveBusiness)

/** GET /api/recipe-cost — derived cost-per-unit + margin for active recipes */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = recipeCostQuerySchema.parse(req.query)
    const result = await getRecipeCostSummary(businessId, query)
    sendSuccess(res, result)
  })
)

export default router
