/**
 * Category Routes — CRUD for product categories
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { resolveBusinessId } from '../lib/business.js'
import {
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
} from '../schemas/product.schemas.js'
import * as categoryService from '../services/category.service.js'

const router = Router()

router.use(auth)

/** GET /api/categories — List all categories */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const categories = await categoryService.listCategories(businessId)
    sendSuccess(res, categories)
  })
)

/** POST /api/categories — Create custom category */
router.post(
  '/',
  validate(createCategorySchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const category = await categoryService.createCategory(businessId, req.body)
    sendSuccess(res, { category }, 201)
  })
)

/** PUT /api/categories/:id — Update category */
router.put(
  '/:id',
  validate(updateCategorySchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const categoryId = String(req.params.id)
    const category = await categoryService.updateCategory(businessId, categoryId, req.body)
    sendSuccess(res, { category })
  })
)

/** DELETE /api/categories/:id — Delete custom category (requires reassignTo in body) */
router.delete(
  '/:id',
  validate(deleteCategorySchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const categoryId = String(req.params.id)
    const result = await categoryService.deleteCategory(businessId, categoryId, req.body.reassignTo)
    sendSuccess(res, result)
  })
)

export default router
