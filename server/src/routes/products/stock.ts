/**
 * Product Stock Routes — stock validation, per-product stock adjustment,
 *                        stock movements, stock history.
 * Mounted under /api/products. All routes require auth (applied by parent router).
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { sendSuccess } from '../../lib/response.js'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import {
  stockAdjustSchema,
  stockMovementQuerySchema,
  stockValidateSchema,
  stockHistorySchema,
} from '../../schemas/product.schemas.js'
import * as productService from '../../services/product.service.js'
import { adjustStock, validateStockForInvoice } from '../../services/stock.service.js'
import { checkAndCreateAlerts } from '../../services/stock-alert.service.js'
import { idempotencyCheck } from '../../middleware/idempotency.js'
import { requirePermission } from '../../middleware/permission.js'

const router = Router()

/** POST /api/products/stock/validate */
router.post(
  '/stock/validate',
  requirePermission('inventory.view'),
  validate(stockValidateSchema),
  asyncHandler(async (req, res) => {
    const result = await validateStockForInvoice(req.user!.businessId, req.body.items)
    sendSuccess(res, result)
  })
)

/** POST /api/products/:id/stock/adjust */
router.post(
  '/:id/stock/adjust',
  requirePermission('inventory.adjustStock'),
  idempotencyCheck(),
  validate(stockAdjustSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.id)
    const data = req.body
    const quantity = data.type === 'ADJUSTMENT_IN' ? data.quantity : -data.quantity

    const result = await prisma.$transaction((tx) =>
      adjustStock(tx, {
        productId,
        businessId,
        quantity,
        type: data.type,
        reason: data.reason,
        customReason: data.customReason,
        notes: data.notes,
        referenceType: 'ADJUSTMENT',
        userId: req.user!.userId,
        movementDate: data.date ? new Date(data.date) : undefined,
      })
    )

    checkAndCreateAlerts(businessId, productId).catch((err) => {
      logger.error('Stock alert check failed', { productId, error: (err as Error).message })
    })

    sendSuccess(res, {
      movement: result.movement,
      product: {
        id: productId,
        currentStock: result.newStock,
        previousStock: result.previousStock,
      },
    })
  })
)

/** GET /api/products/:id/stock/movements */
router.get(
  '/:id/stock/movements',
  asyncHandler(async (req, res) => {
    const query = stockMovementQuerySchema.parse(req.query)
    const result = await productService.listStockMovements(
      req.user!.businessId,
      String(req.params.id),
      query
    )
    sendSuccess(res, result)
  })
)

/** GET /api/products/:id/stock/history — Feature #102 */
router.get(
  '/:id/stock/history',
  asyncHandler(async (req, res) => {
    const query = stockHistorySchema.parse(req.query)
    const result = await productService.listStockHistory(
      req.user!.businessId,
      String(req.params.id),
      query
    )
    sendSuccess(res, result)
  })
)

export default router
