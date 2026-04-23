/**
 * Product Bulk Routes — bulk stock adjust, bulk import, export, reorder list,
 *                       label data (Feature #103), barcode lookup (Feature #97).
 * Mounted under /api/products. All routes require auth (applied by parent router).
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { sendSuccess } from '../../lib/response.js'
import { prisma } from '../../lib/prisma.js'
import {
  bulkImportProductSchema,
  exportProductsSchema,
  reorderListSchema,
  barcodeSearchSchema,
  bulkStockAdjustSchema,
  labelDataSchema,
} from '../../schemas/product.schemas.js'
import * as productService from '../../services/product.service.js'
import * as bulkService from '../../services/product-bulk.service.js'
import { requirePermission } from '../../middleware/permission.js'

const router = Router()

/** POST /api/products/stock/bulk-adjust — Feature #102 */
router.post(
  '/stock/bulk-adjust',
  requirePermission('inventory.adjustStock'),
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
  requirePermission('inventory.create'),
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
  requirePermission('inventory.view'),
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

export default router
