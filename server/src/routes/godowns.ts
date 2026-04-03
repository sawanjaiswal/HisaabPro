/**
 * Godown Routes — Phase 4 (#101 Multi-Godown)
 * Mounted at /api/godowns
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { requirePlan } from '../middleware/subscription-gate.js'
import { sendSuccess } from '../lib/response.js'
import {
  createGodownSchema,
  updateGodownSchema,
  godownStockQuerySchema,
  transferStockSchema,
  transferHistorySchema,
} from '../schemas/godown.schemas.js'
import * as godownService from '../services/godown.service.js'
import * as godownTransferService from '../services/godown-transfer.service.js'

const router = Router()

router.use(auth)
router.use(requirePlan('BUSINESS'))

// ============================================================
// Godown CRUD
// ============================================================

/** GET /api/godowns — list all godowns for business */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const godowns = await godownService.listGodowns(businessId)
    sendSuccess(res, { godowns })
  })
)

/** POST /api/godowns — create godown */
router.post(
  '/',
  requirePermission('inventory.edit'),
  validate(createGodownSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const godown = await godownService.createGodown(businessId, req.body)
    sendSuccess(res, { godown }, 201)
  })
)

// ============================================================
// Stock transfer endpoints
// NOTE: /transfer and /transfers must be before /:id to avoid route collision
// ============================================================

/** POST /api/godowns/transfer — transfer stock between godowns */
router.post(
  '/transfer',
  requirePermission('inventory.edit'),
  validate(transferStockSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const transfer = await godownTransferService.transferStock(businessId, userId, req.body)
    sendSuccess(res, { transfer }, 201)
  })
)

/** GET /api/godowns/transfers — transfer history */
router.get(
  '/transfers',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = transferHistorySchema.parse(req.query)
    const result = await godownTransferService.listTransferHistory(businessId, query)
    sendSuccess(res, result)
  })
)

// ============================================================
// Godown-specific endpoints (with :id)
// ============================================================

/** PATCH /api/godowns/:id — update godown */
router.patch(
  '/:id',
  requirePermission('inventory.edit'),
  validate(updateGodownSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const godownId = String(req.params.id)
    const godown = await godownService.updateGodown(businessId, godownId, req.body)
    sendSuccess(res, { godown })
  })
)

/** DELETE /api/godowns/:id — soft delete (only if no stock) */
router.delete(
  '/:id',
  requirePermission('inventory.delete'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const godownId = String(req.params.id)
    const result = await godownService.deleteGodown(businessId, godownId)
    sendSuccess(res, result)
  })
)

/** GET /api/godowns/:id/stock — stock in this godown */
router.get(
  '/:id/stock',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const godownId = String(req.params.id)
    const query = godownStockQuerySchema.parse(req.query)
    const result = await godownService.getGodownStock(businessId, godownId, query)
    sendSuccess(res, result)
  })
)

export default router
