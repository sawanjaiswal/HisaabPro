/**
 * Price List bulk-assign + price-preview routes.
 * Bulk assign: POST /api/price-lists/:id/bulk-assign-parties
 * Price preview: GET /api/products/:id/price-preview
 *   (price-preview handler is exported separately for use in the products router)
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { bulkAssignPartiesSchema } from '../validators/price-list.schema.js'
import * as assignService from '../services/price-list-assign.service.js'

// ── Bulk-assign sub-router ────────────────────────────────────────────────────
// Mounted under /api/price-lists with mergeParams to access :id from parent.

const assignRouter = Router({ mergeParams: true })

assignRouter.use(auth)

/**
 * POST /api/price-lists/:id/bulk-assign-parties
 * Body: { partyIds: string[] (1–500) }
 * Returns { assigned: count, partyPricingOverlapCount }
 */
assignRouter.post(
  '/',
  validate(bulkAssignPartiesSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const priceListId = String(req.params.id)
    const { partyIds } = req.body as { partyIds: string[] }
    const result = await assignService.bulkAssignParties(businessId, priceListId, partyIds)
    sendSuccess(res, result)
  })
)

export { assignRouter }

// ── Price preview router ──────────────────────────────────────────────────────
// Standalone router; mounted at /api/products in the products index or app.routes.ts

const pricePreviewRouter = Router({ mergeParams: true })

pricePreviewRouter.use(auth)

/**
 * GET /api/products/:id/price-preview
 * Returns all active price lists with their entries for the given product,
 * including a resolved price at qty=1 computed by the pricing-resolver.
 */
pricePreviewRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.id)
    const preview = await assignService.getPricePreview(businessId, productId)
    sendSuccess(res, { preview })
  })
)

export { pricePreviewRouter }
