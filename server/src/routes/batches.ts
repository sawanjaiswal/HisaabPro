/**
 * Batch Routes — Phase 4 (#99 Batch Tracking + #105 Expiry Alerts)
 * Mounted at /api/products/:productId/batches and /api/batches
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import {
  createBatchSchema,
  updateBatchSchema,
  listBatchesSchema,
  expiringBatchesSchema,
} from '../schemas/batch.schemas.js'
import * as batchService from '../services/batch.service.js'

const router = Router()

router.use(auth)

// ============================================================
// Product-scoped batch endpoints
// ============================================================

/** GET /api/products/:productId/batches — list batches for a product */
router.get(
  '/products/:productId/batches',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.productId)
    const query = listBatchesSchema.parse(req.query)
    const result = await batchService.listBatches(businessId, productId, query)
    sendSuccess(res, result)
  })
)

/** POST /api/products/:productId/batches — create batch */
router.post(
  '/products/:productId/batches',
  validate(createBatchSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.productId)
    const batch = await batchService.createBatch(businessId, productId, req.body)
    sendSuccess(res, { batch }, 201)
  })
)

// ============================================================
// Batch-level endpoints
// ============================================================

/** GET /api/batches/expiring — batches expiring within N days (report) */
/** NOTE: Must be before /:id to avoid matching "expiring" as an ID */
router.get(
  '/batches/expiring',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = expiringBatchesSchema.parse(req.query)
    const result = await batchService.getExpiringBatches(businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/batches/:id — get batch detail */
router.get(
  '/batches/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const batchId = String(req.params.id)
    const batch = await batchService.getBatch(businessId, batchId)
    sendSuccess(res, { batch })
  })
)

/** PATCH /api/batches/:id — update batch */
router.patch(
  '/batches/:id',
  validate(updateBatchSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const batchId = String(req.params.id)
    const batch = await batchService.updateBatch(businessId, batchId, req.body)
    sendSuccess(res, { batch })
  })
)

/** DELETE /api/batches/:id — soft delete (only if stock = 0) */
router.delete(
  '/batches/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const batchId = String(req.params.id)
    const result = await batchService.deleteBatch(businessId, batchId)
    sendSuccess(res, result)
  })
)

export default router
