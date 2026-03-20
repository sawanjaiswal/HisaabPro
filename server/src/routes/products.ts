/**
 * Product Routes — CRUD, stock adjustments, stock movements, stock validation
 * All routes require auth. businessId resolved from user's active BusinessUser record.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { prisma } from '../lib/prisma.js'
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  stockAdjustSchema,
  stockMovementQuerySchema,
  stockValidateSchema,
} from '../schemas/product.schemas.js'
import * as productService from '../services/product.service.js'
import { adjustStock, validateStockForInvoice } from '../services/stock.service.js'
import { checkAndCreateAlerts } from '../services/stock-alert.service.js'
import { idempotencyCheck } from '../middleware/idempotency.js'

const router = Router()

router.use(auth)

// ============================================================
// Products
// ============================================================

/** POST /api/products/stock/validate — Validate stock before invoice save */
/** NOTE: Must be before /:id routes to avoid matching "stock" as an ID */
router.post(
  '/stock/validate',
  validate(stockValidateSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await validateStockForInvoice(businessId, req.body.items)
    sendSuccess(res, result)
  })
)

/** POST /api/products — Create product */
router.post(
  '/',
  validate(createProductSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const product = await productService.createProduct(businessId, req.user!.userId, req.body)
    sendSuccess(res, { product }, 201)
  })
)

/** GET /api/products — List products */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listProductsSchema.parse(req.query)
    const result = await productService.listProducts(businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/products/:id — Get product detail */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.id)
    const product = await productService.getProduct(businessId, productId)
    sendSuccess(res, { product })
  })
)

/** PUT /api/products/:id — Update product */
router.put(
  '/:id',
  validate(updateProductSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.id)
    const product = await productService.updateProduct(businessId, productId, req.body)
    sendSuccess(res, { product })
  })
)

/** DELETE /api/products/:id — Soft delete product */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.id)
    const result = await productService.deleteProduct(businessId, productId)
    sendSuccess(res, result)
  })
)

// ============================================================
// Stock
// ============================================================

/** POST /api/products/:id/stock/adjust — Manual stock adjustment */
router.post(
  '/:id/stock/adjust',
  idempotencyCheck(),
  validate(stockAdjustSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.id)
    const data = req.body

    const quantity = data.type === 'ADJUSTMENT_IN' ? data.quantity : -data.quantity

    const result = await prisma.$transaction(async (tx) => {
      return adjustStock(tx, {
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
    })

    // Fire-and-forget stock alert check (never blocks the response)
    checkAndCreateAlerts(businessId, productId).catch(() => {})

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

/** GET /api/products/:id/stock/movements — Stock movement log */
router.get(
  '/:id/stock/movements',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.id)
    const query = stockMovementQuerySchema.parse(req.query)
    const result = await productService.listStockMovements(businessId, productId, query)
    sendSuccess(res, result)
  })
)

export default router
