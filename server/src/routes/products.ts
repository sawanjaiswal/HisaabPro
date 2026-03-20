/**
 * Product Routes — CRUD, stock adjustments, stock movements, stock validation,
 *                  bulk import/export (#104), reorder list (#106),
 *                  item images (#108), barcode lookup (#110), label data (#103)
 * All routes require auth. businessId resolved from req.user.businessId.
 *
 * ROUTE ORDER: all static paths MUST come before /:id to avoid param capture.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { prisma } from '../lib/prisma.js'
import { notFoundError, validationError } from '../lib/errors.js'
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  stockAdjustSchema,
  stockMovementQuerySchema,
  stockValidateSchema,
  bulkImportProductSchema,
  exportProductsSchema,
  reorderListSchema,
  barcodeSearchSchema,
  stockHistorySchema,
  bulkStockAdjustSchema,
  productImageSchema,
  labelDataSchema,
} from '../schemas/product.schemas.js'
import * as productService from '../services/product.service.js'
import * as bulkService from '../services/product-bulk.service.js'
import { adjustStock, validateStockForInvoice } from '../services/stock.service.js'
import { checkAndCreateAlerts } from '../services/stock-alert.service.js'
import { idempotencyCheck } from '../middleware/idempotency.js'

const router = Router()

router.use(auth)

// ============================================================
// Static routes — MUST be before /:id to avoid param capture
// ============================================================

/** POST /api/products/stock/validate */
router.post(
  '/stock/validate',
  validate(stockValidateSchema),
  asyncHandler(async (req, res) => {
    const result = await validateStockForInvoice(req.user!.businessId, req.body.items)
    sendSuccess(res, result)
  })
)

/** POST /api/products/stock/bulk-adjust — Feature #102 */
router.post(
  '/stock/bulk-adjust',
  validate(bulkStockAdjustSchema),
  asyncHandler(async (req, res) => {
    const result = await productService.bulkAdjustStock(
      req.user!.businessId,
      req.user!.userId,
      req.body
    )
    sendSuccess(res, result)
  })
)

/** POST /api/products/bulk-import — Feature #104 */
router.post(
  '/bulk-import',
  validate(bulkImportProductSchema),
  asyncHandler(async (req, res) => {
    const result = await bulkService.bulkImportProducts(
      req.user!.businessId,
      req.user!.userId,
      req.body.products
    )
    sendSuccess(res, result, 207)
  })
)

/** POST /api/products/label-data — Feature #103: batch label printing data */
router.post(
  '/label-data',
  validate(labelDataSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { productIds, template } = req.body as { productIds: string[]; template?: string }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId },
      select: {
        id: true,
        name: true,
        sku: true,
        salePrice: true,
        imageUrl: true,
        labelTemplate: true,
        category: { select: { name: true } },
        unit: { select: { symbol: true } },
      },
      orderBy: { name: 'asc' },
    })

    const labels = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku ?? null,
      salePrice: p.salePrice,
      imageUrl: p.imageUrl ?? null,
      unit: p.unit.symbol,
      category: p.category?.name ?? null,
      template: template ?? p.labelTemplate ?? 'standard',
    }))

    sendSuccess(res, { labels, count: labels.length })
  })
)

/** GET /api/products/export — Feature #104 */
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const query = exportProductsSchema.parse(req.query)
    const result = await bulkService.exportProducts(req.user!.businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/products/reorder-list — Feature #106 */
router.get(
  '/reorder-list',
  asyncHandler(async (req, res) => {
    const query = reorderListSchema.parse(req.query)
    const result = await bulkService.getReorderList(req.user!.businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/products/by-barcode/:code — Feature #97: barcode lookup */
router.get(
  '/by-barcode/:code',
  asyncHandler(async (req, res) => {
    const { code } = barcodeSearchSchema.parse({ code: req.params.code })
    const product = await productService.findByBarcode(req.user!.businessId, code)
    sendSuccess(res, { product })
  })
)

// ============================================================
// Product CRUD
// ============================================================

/** POST /api/products */
router.post(
  '/',
  validate(createProductSchema),
  asyncHandler(async (req, res) => {
    const product = await productService.createProduct(
      req.user!.businessId,
      req.user!.userId,
      req.body
    )
    sendSuccess(res, { product }, 201)
  })
)

/** GET /api/products */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listProductsSchema.parse(req.query)
    const result = await productService.listProducts(req.user!.businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/products/:id */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await productService.getProduct(
      req.user!.businessId,
      String(req.params.id)
    )
    sendSuccess(res, { product })
  })
)

/** PUT /api/products/:id */
router.put(
  '/:id',
  validate(updateProductSchema),
  asyncHandler(async (req, res) => {
    const product = await productService.updateProduct(
      req.user!.businessId,
      String(req.params.id),
      req.body
    )
    sendSuccess(res, { product })
  })
)

/** DELETE /api/products/:id */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await productService.deleteProduct(
      req.user!.businessId,
      String(req.params.id)
    )
    sendSuccess(res, result)
  })
)

// ============================================================
// Stock
// ============================================================

/** POST /api/products/:id/stock/adjust */
router.post(
  '/:id/stock/adjust',
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

// ============================================================
// Feature #108 — Item Images
// ============================================================

/** POST /api/products/:id/images — Set or add images to a product (max 5) */
router.post(
  '/:id/images',
  validate(productImageSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.id)

    const existing = await prisma.product.findFirst({
      where: { id: productId, businessId },
      select: { id: true, imageUrl: true, images: true },
    })
    if (!existing) throw notFoundError('Product')

    const { imageUrl, images: newImages } = req.body as {
      imageUrl?: string
      images?: string[]
    }

    const merged = Array.from(
      new Set([...existing.images, ...(newImages ?? []), ...(imageUrl ? [imageUrl] : [])])
    ).slice(0, 5)

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        images: merged,
        // Set imageUrl to the supplied primary, or keep existing, or first in merged
        imageUrl: imageUrl ?? existing.imageUrl ?? (merged[0] ?? null),
      },
      select: { id: true, imageUrl: true, images: true },
    })

    sendSuccess(res, { product: updated })
  })
)

/** DELETE /api/products/:id/images/:index — Remove image at index */
router.delete(
  '/:id/images/:index',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.id)
    const index = parseInt(String(req.params.index), 10)

    if (isNaN(index) || index < 0) {
      throw validationError('Image index must be a non-negative integer')
    }

    const existing = await prisma.product.findFirst({
      where: { id: productId, businessId },
      select: { id: true, imageUrl: true, images: true },
    })
    if (!existing) throw notFoundError('Product')

    if (index >= existing.images.length) {
      throw validationError(
        `Image index ${index} out of range (product has ${existing.images.length} images)`
      )
    }

    const removedUrl = existing.images[index]
    const updatedImages = existing.images.filter((_, i) => i !== index)
    const newImageUrl = existing.imageUrl === removedUrl
      ? (updatedImages[0] ?? null)
      : existing.imageUrl

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { images: updatedImages, imageUrl: newImageUrl },
      select: { id: true, imageUrl: true, images: true },
    })

    sendSuccess(res, { product: updated })
  })
)

export default router
