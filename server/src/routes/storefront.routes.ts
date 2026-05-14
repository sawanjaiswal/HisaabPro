/**
 * Authenticated storefront routes — Epic C PR4 (#121).
 *
 * Mounted at: /api/businesses/me/storefront
 * Auth: requireAuth (all routes)
 * Tenant scope: req.user.businessId (never trusted from body/params)
 *
 * ARCHITECTURE §H: slug validated → normalised → uniqueness-checked in service.
 */

import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import {
  patchStorefrontSchema,
  addStorefrontProductsSchema,
  patchStorefrontProductSchema,
} from '../validators/storefront.validators.js'
import {
  getStorefrontSettings,
  updateStorefrontSettings,
  listStorefrontProducts,
  addStorefrontProducts,
  removeStorefrontProduct,
  updateStorefrontProduct,
} from '../services/storefront.service.js'


const router = Router()

// All routes require auth
router.use(auth)

// ---------------------------------------------------------------------------
// GET /api/businesses/me/storefront
// ---------------------------------------------------------------------------

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const settings = await getStorefrontSettings(businessId)
    res.status(200).json({ success: true, data: settings })
  })
)

// ---------------------------------------------------------------------------
// PATCH /api/businesses/me/storefront
// ---------------------------------------------------------------------------

router.patch(
  '/',
  validate(patchStorefrontSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const body = req.body as {
      slug?: string
      isPublic?: boolean
      tagline?: string | null
      theme?: string
      whatsapp?: string | null
    }

    await updateStorefrontSettings({
      businessId,
      slug: body.slug,
      isPublic: body.isPublic,
      tagline: body.tagline,
      theme: body.theme,
      whatsapp: body.whatsapp,
    })

    const updated = await getStorefrontSettings(businessId)
    res.status(200).json({ success: true, data: updated, message: 'Storefront settings updated' })
  })
)

// ---------------------------------------------------------------------------
// GET /api/businesses/me/storefront/products
// ---------------------------------------------------------------------------

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const products = await listStorefrontProducts(businessId)
    res.status(200).json({ success: true, data: products })
  })
)

// ---------------------------------------------------------------------------
// POST /api/businesses/me/storefront/products
// ---------------------------------------------------------------------------

router.post(
  '/products',
  validate(addStorefrontProductsSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { productIds } = req.body as { productIds: string[] }
    const result = await addStorefrontProducts(businessId, productIds)
    res.status(201).json({ success: true, data: result, message: 'Products added to storefront' })
  })
)

// ---------------------------------------------------------------------------
// DELETE /api/businesses/me/storefront/products/:productId
// ---------------------------------------------------------------------------

router.delete(
  '/products/:productId',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = req.params['productId'] as string
    await removeStorefrontProduct(businessId, productId)
    res.status(200).json({ success: true, message: 'Product removed from storefront' })
  })
)

// ---------------------------------------------------------------------------
// PATCH /api/businesses/me/storefront/products/:productId
// ---------------------------------------------------------------------------

router.patch(
  '/products/:productId',
  validate(patchStorefrontProductSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = req.params['productId'] as string
    const patch = req.body as { sortOrder?: number; visible?: boolean; priceVisible?: boolean }
    await updateStorefrontProduct(businessId, productId, patch)
    res.status(200).json({ success: true, message: 'Storefront product updated' })
  })
)

export default router
