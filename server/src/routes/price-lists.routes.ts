/**
 * Price List CRUD routes — create, list, get, rename, soft-delete.
 * Mounted at /api/price-lists. All routes require auth.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import {
  createPriceListSchema,
  updatePriceListSchema,
} from '../validators/price-list.schema.js'
import * as priceListService from '../services/price-list.service.js'

const router = Router()

router.use(auth)

// ── List all ──────────────────────────────────────────────────────────────────

/**
 * GET /api/price-lists
 * Returns all non-deleted price lists for the authenticated business.
 * Each item includes entryCount and partyCount via _count aggregates.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const lists = await priceListService.listPriceLists(businessId)
    sendSuccess(res, { lists })
  })
)

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * POST /api/price-lists
 * Body: { name: string (1-60), isDefault?: boolean }
 * If isDefault: true, atomically sets this as the business default list.
 */
router.post(
  '/',
  validate(createPriceListSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const list = await priceListService.createPriceList(businessId, req.body)
    sendSuccess(res, { list }, 201)
  })
)

// ── Get single ────────────────────────────────────────────────────────────────

/**
 * GET /api/price-lists/:id
 * Returns the price list with all non-deleted entries and product details.
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const list = await priceListService.getPriceList(businessId, String(req.params.id))
    sendSuccess(res, { list })
  })
)

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * PATCH /api/price-lists/:id
 * Body: { name?: string, isDefault?: boolean }
 * At least one field required. Default-list change is transactional.
 */
router.patch(
  '/:id',
  validate(updatePriceListSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const list = await priceListService.updatePriceList(businessId, String(req.params.id), req.body)
    sendSuccess(res, { list })
  })
)

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * DELETE /api/price-lists/:id
 * Soft-deletes the list. Rejects (409) if the list is the business default.
 * Clears Party.priceListId references in the same transaction.
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    await priceListService.deletePriceList(businessId, String(req.params.id))
    sendSuccess(res, { deleted: true })
  })
)

export default router
