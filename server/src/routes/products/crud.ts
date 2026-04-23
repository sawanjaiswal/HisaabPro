/**
 * Product CRUD Routes — create, list, get, update, delete.
 * Mounted under /api/products. All routes require auth (applied by parent router).
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { sendSuccess } from '../../lib/response.js'
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
} from '../../schemas/product.schemas.js'
import * as productService from '../../services/product.service.js'
import { requirePermission } from '../../middleware/permission.js'

const router = Router()

/** POST /api/products */
router.post(
  '/',
  requirePermission('inventory.create'),
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
  requirePermission('inventory.edit'),
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
  requirePermission('inventory.delete'),
  asyncHandler(async (req, res) => {
    const result = await productService.deleteProduct(
      req.user!.businessId,
      String(req.params.id)
    )
    sendSuccess(res, result)
  })
)

export default router
