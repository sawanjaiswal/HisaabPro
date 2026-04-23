/**
 * Product Image Routes — Feature #108: add / remove product images (max 5).
 * Mounted under /api/products. All routes require auth (applied by parent router).
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { sendSuccess } from '../../lib/response.js'
import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { productImageSchema } from '../../schemas/product.schemas.js'
import { requirePermission } from '../../middleware/permission.js'

const router = Router()

/** POST /api/products/:id/images — Set or add images to a product (max 5) */
router.post(
  '/:id/images',
  requirePermission('inventory.edit'),
  validate(productImageSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.id)

    const { imageUrl, images: newImages } = req.body as {
      imageUrl?: string
      images?: string[]
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findFirst({
        where: { id: productId, businessId },
        select: { id: true, imageUrl: true, images: true },
      })
      if (!existing) throw notFoundError('Product')

      const merged = Array.from(
        new Set([...existing.images, ...(newImages ?? []), ...(imageUrl ? [imageUrl] : [])])
      ).slice(0, 5)

      return tx.product.update({
        where: { id: productId },
        data: {
          images: merged,
          imageUrl: imageUrl ?? existing.imageUrl ?? (merged[0] ?? null),
        },
        select: { id: true, imageUrl: true, images: true },
      })
    })

    sendSuccess(res, { product: updated })
  })
)

/** DELETE /api/products/:id/images/:index — Remove image at index */
router.delete(
  '/:id/images/:index',
  requirePermission('inventory.edit'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.id)
    const index = parseInt(String(req.params.index), 10)

    if (isNaN(index) || index < 0) {
      throw validationError('Image index must be a non-negative integer')
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findFirst({
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

      return tx.product.update({
        where: { id: productId },
        data: { images: updatedImages, imageUrl: newImageUrl },
        select: { id: true, imageUrl: true, images: true },
      })
    })

    sendSuccess(res, { product: updated })
  })
)

export default router
