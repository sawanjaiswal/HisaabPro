/**
 * Serial Number Routes — Phase 4 (#100 Serial Number Tracking)
 * Per-unit tracking for products (electronics, equipment, etc.)
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { sendSuccess } from '../lib/response.js'
import {
  createSerialNumberSchema,
  bulkCreateSerialNumbersSchema,
  updateSerialNumberSchema,
  listSerialNumbersSchema,
  serialLookupSchema,
} from '../schemas/serial-number.schemas.js'
import * as serialService from '../services/serial-number.service.js'

const router = Router()

router.use(auth)

// ============================================================
// Global serial lookup (before /:id params)
// ============================================================

/** GET /api/serial-numbers/lookup?serial=ABC123 — find serial across all products */
router.get(
  '/lookup',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { serial } = serialLookupSchema.parse(req.query)
    const result = await serialService.lookupBySerial(businessId, serial)
    sendSuccess(res, { serialNumber: result })
  })
)

// ============================================================
// Product-scoped endpoints
// ============================================================

/** GET /api/serial-numbers/product/:productId — list serials for a product */
router.get(
  '/product/:productId',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.productId)
    const query = listSerialNumbersSchema.parse(req.query)
    const result = await serialService.listSerialNumbers(businessId, productId, query)
    sendSuccess(res, result)
  })
)

/** POST /api/serial-numbers/product/:productId — create single serial */
router.post(
  '/product/:productId',
  requirePermission('inventory.edit'),
  validate(createSerialNumberSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.productId)
    const serial = await serialService.createSerialNumber(businessId, productId, req.body)
    sendSuccess(res, { serialNumber: serial }, 201)
  })
)

/** POST /api/serial-numbers/product/:productId/bulk — bulk create serials */
router.post(
  '/product/:productId/bulk',
  requirePermission('inventory.edit'),
  validate(bulkCreateSerialNumbersSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.productId)
    const result = await serialService.bulkCreateSerialNumbers(businessId, productId, req.body)
    const status = result.errors.length > 0 ? 207 : 201
    sendSuccess(res, result, status)
  })
)

// ============================================================
// Serial-level endpoints
// ============================================================

/** GET /api/serial-numbers/:id — get serial detail */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const serial = await serialService.getSerialNumber(businessId, String(req.params.id))
    sendSuccess(res, { serialNumber: serial })
  })
)

/** PATCH /api/serial-numbers/:id — update status/notes */
router.patch(
  '/:id',
  requirePermission('inventory.edit'),
  validate(updateSerialNumberSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const serial = await serialService.updateSerialNumber(businessId, String(req.params.id), req.body)
    sendSuccess(res, { serialNumber: serial })
  })
)

export default router
