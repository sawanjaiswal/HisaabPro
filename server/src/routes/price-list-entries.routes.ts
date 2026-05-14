/**
 * Price List Entry routes — add, edit, soft-delete entries on a price list.
 * Mounted at /api/price-lists (merged with the parent router via app.routes.ts).
 * All routes require auth (applied by parent router binding).
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import {
  createEntrySchema,
  updateEntrySchema,
} from '../validators/price-list.schema.js'
import * as entryService from '../services/price-list-entry.service.js'

const router = Router({ mergeParams: true })

router.use(auth)

// ── Add entry ─────────────────────────────────────────────────────────────────

/**
 * POST /api/price-lists/:id/entries
 * Body: { productId, mode, valuePaise?, percentBps?, fixedOffPaise?, minQty, maxQty? }
 * Rejects with 400 if qty range overlaps an existing entry for the same product.
 */
router.post(
  '/',
  validate(createEntrySchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const priceListId = String(req.params.id)
    const entry = await entryService.createEntry(businessId, priceListId, req.body)
    sendSuccess(res, { entry }, 201)
  })
)

// ── Update entry ──────────────────────────────────────────────────────────────

/**
 * PATCH /api/price-lists/:id/entries/:entryId
 * Body: subset of entry fields. Overlap checked when qty fields change.
 */
router.patch(
  '/:entryId',
  validate(updateEntrySchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const priceListId = String(req.params.id)
    const entryId = String(req.params.entryId)
    const entry = await entryService.updateEntry(businessId, priceListId, entryId, req.body)
    sendSuccess(res, { entry })
  })
)

// ── Delete entry ──────────────────────────────────────────────────────────────

/**
 * DELETE /api/price-lists/:id/entries/:entryId
 * Soft-deletes the entry (sets isDeleted + deletedAt).
 */
router.delete(
  '/:entryId',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const priceListId = String(req.params.id)
    const entryId = String(req.params.entryId)
    await entryService.deleteEntry(businessId, priceListId, entryId)
    sendSuccess(res, { deleted: true })
  })
)

export default router
