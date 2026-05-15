/**
 * Custom Orders Router — 10 endpoints
 * Mount point: /api/custom-orders (registered in app.ts after jobRoutes)
 */

import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { requirePermission } from '../middleware/permission.js'
import { sendSuccess } from '../lib/response.js'
import {
  createCustomOrderSchema,
  updateCustomOrderSchema,
  transitionCustomOrderSchema,
  listCustomOrdersSchema,
  recordAdvanceSchema,
} from '../schemas/custom-order.schemas.js'
import type {
  TransitionCustomOrderInput,
  RecordAdvanceInput,
} from '../schemas/custom-order.schemas.js'
import { type CustomOrderStatus } from '@prisma/client'
import * as customOrderService from '../services/custom-order.service.js'
import { idempotencyCheck } from '../middleware/idempotency.js'

const router = Router()

// Auth required for all custom-order routes
router.use(auth)

/** GET /api/custom-orders/recycle — List soft-deleted orders */
router.get(
  '/recycle',
  requirePermission('orders.delete'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await customOrderService.listDeletedOrders(businessId)
    sendSuccess(res, result)
  })
)

/** GET /api/custom-orders — List custom orders */
router.get(
  '/',
  requirePermission('orders.view'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listCustomOrdersSchema.parse(req.query)
    const result = await customOrderService.listCustomOrders(businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/custom-orders/:id — Get order detail */
router.get(
  '/:id',
  requirePermission('orders.view'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const order = await customOrderService.getCustomOrder(businessId, String(req.params.id))
    sendSuccess(res, order)
  })
)

/** POST /api/custom-orders — Create custom order */
router.post(
  '/',
  requirePermission('orders.create'),
  validate(createCustomOrderSchema),
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const order = await customOrderService.createCustomOrder(businessId, req.user!.userId, req.body)
    sendSuccess(res, order, 201)
  })
)

/** PATCH /api/custom-orders/:id — Update custom order */
router.patch(
  '/:id',
  requirePermission('orders.edit'),
  validate(updateCustomOrderSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const order = await customOrderService.updateCustomOrder(
      businessId, String(req.params.id), req.user!.userId, req.body
    )
    sendSuccess(res, order)
  })
)

/** POST /api/custom-orders/:id/transition — Transition order status */
router.post(
  '/:id/transition',
  requirePermission('orders.edit'),
  validate(transitionCustomOrderSchema),
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const body = req.body as TransitionCustomOrderInput
    const order = await customOrderService.transitionCustomOrder(
      businessId,
      String(req.params.id),
      req.user!.userId,
      body.toStatus as CustomOrderStatus,
      body.reason
    )
    sendSuccess(res, order)
  })
)

/** POST /api/custom-orders/:id/advances — Record an advance payment */
router.post(
  '/:id/advances',
  requirePermission('orders.edit'),
  validate(recordAdvanceSchema),
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const input = req.body as RecordAdvanceInput
    const order = await customOrderService.recordAdvance(
      businessId, String(req.params.id), req.user!.userId, input
    )
    sendSuccess(res, order, 201)
  })
)

/** DELETE /api/custom-orders/:id/advances/:advanceId — Delete an advance */
router.delete(
  '/:id/advances/:advanceId',
  requirePermission('orders.edit'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const order = await customOrderService.deleteAdvance(
      businessId,
      String(req.params.id),
      String(req.params.advanceId),
      req.user!.userId
    )
    sendSuccess(res, order)
  })
)

/** POST /api/custom-orders/:id/convert-to-invoice — Convert to SALE_INVOICE */
router.post(
  '/:id/convert-to-invoice',
  requirePermission('orders.edit'),
  requirePermission('invoicing.create'),
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const invoice = await customOrderService.convertCustomOrderToInvoice(
      businessId, String(req.params.id), req.user!.userId
    )
    sendSuccess(res, invoice, 201)
  })
)

/** DELETE /api/custom-orders/:id — Soft delete order */
router.delete(
  '/:id',
  requirePermission('orders.delete'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await customOrderService.softDeleteCustomOrder(
      businessId, String(req.params.id), req.user!.userId
    )
    sendSuccess(res, result)
  })
)

/** POST /api/custom-orders/:id/restore — Restore from recycle bin */
router.post(
  '/:id/restore',
  requirePermission('orders.delete'),
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await customOrderService.restoreOrder(businessId, String(req.params.id))
    sendSuccess(res, result)
  })
)

/** DELETE /api/custom-orders/:id/permanent — Permanently delete from recycle bin */
router.delete(
  '/:id/permanent',
  requirePermission('orders.delete'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await customOrderService.permanentDeleteOrder(businessId, String(req.params.id))
    sendSuccess(res, result)
  })
)

export default router
