/**
 * Smart inventory reorder suggestions (#148) — read-only.
 * Mounted at /api/inventory/reorder-suggestions. Auth-only, like
 * stock-alerts: core inventory management, not a premium gate.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { reorderSuggestionSchema } from '../schemas/reorder.schemas.js'
import { getReorderSuggestions } from '../services/inventory/reorder.service.js'

const router = Router()

/** GET /api/inventory/reorder-suggestions — velocity-based reorder list */
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    if (!businessId) {
      sendError(res, 'No active business', 'NO_BUSINESS', 400)
      return
    }
    const query = reorderSuggestionSchema.parse(req.query)
    const result = await getReorderSuggestions(businessId, query)
    sendSuccess(res, result)
  }),
)

export default router
