/**
 * Product Image Routes — Feature #108: add / remove product images (max 5).
 * Mounted under /api/products. All routes require auth (applied by parent router).
 *
 * PR4 hardening: accepts base64 data:image/(jpeg|png|webp) URLs in addition
 * to https URLs. Per-entry 1MB cap, 5-entry max, 6MB express.json override.
 */

import express, { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { sendSuccess } from '../../lib/response.js'
import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode, notFoundError, validationError } from '../../lib/errors.js'
import { productImageSchema } from '../../schemas/product.schemas.js'
import { requirePermission } from '../../middleware/permission.js'

const router = Router()

const MAX_IMAGE_BYTES = 1_048_576 // 1 MB after base64 decode
const DATA_URL_REGEX = /^data:image\/(jpeg|png|webp);base64,/

/** 6 MB body limit for this route only (global is 2 MB) */
const imageSizeParser = express.json({ limit: '6mb' })

function validateEntry(entry: string, index: number): void {
  if (DATA_URL_REGEX.test(entry)) {
    const b64 = entry.split(',')[1] ?? ''
    const approxBytes = Math.floor(b64.length * 0.75)
    if (approxBytes > MAX_IMAGE_BYTES) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Image exceeds 1 MB limit', {
        code: 'IMAGE_TOO_LARGE',
        index,
        sizeBytes: approxBytes,
        maxBytes: MAX_IMAGE_BYTES,
      })
    }
    return
  }
  try {
    const url = new URL(entry)
    if (url.protocol !== 'https:') throw new Error('not https')
  } catch {
    throw validationError(`Image at index ${index} must be a data:image/(jpeg|png|webp);base64,... URL or an https URL`)
  }
}

/** POST /api/products/:id/images — Set or add images to a product (max 5) */
router.post(
  '/:id/images',
  imageSizeParser,
  requirePermission('inventory.edit'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const productId = String(req.params.id)

    // Parse and validate via Zod (catches structural issues)
    const parsed = productImageSchema.safeParse(req.body)
    if (!parsed.success) {
      // Surface IMAGE_TOO_LARGE from the custom superRefine
      const imgTooLarge = parsed.error.issues.find(i => i.message.startsWith('IMAGE_TOO_LARGE:'))
      if (imgTooLarge) {
        const bytes = parseInt(imgTooLarge.message.split(':')[1] ?? '0', 10)
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Image exceeds 1 MB limit', {
          code: 'IMAGE_TOO_LARGE',
          index: (imgTooLarge.path[1] as number | undefined) ?? 0,
          sizeBytes: bytes,
          maxBytes: MAX_IMAGE_BYTES,
        })
      }
      throw validationError(parsed.error.issues.map(i => i.message).join('; '))
    }

    const { imageUrl, images: newImages } = parsed.data

    // Individual entry validation (data-URL MIME check + size)
    const allEntries = [...(newImages ?? []), ...(imageUrl ? [imageUrl] : [])]
    allEntries.forEach((e, i) => validateEntry(e, i))

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findFirst({
        where: { id: productId, businessId },
        select: { id: true, imageUrl: true, images: true },
      })
      if (!existing) throw notFoundError('Product')

      // Merge: deduplicate, prefer existing order, cap at 5
      const merged = Array.from(
        new Set([...existing.images, ...(newImages ?? []), ...(imageUrl ? [imageUrl] : [])])
      )
      if (merged.length > 5) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Maximum 5 images per product', {
          code: 'MAX_IMAGES_EXCEEDED',
          current: existing.images.length,
          attempting: allEntries.length,
        })
      }
      const final = merged.slice(0, 5)

      return tx.product.update({
        where: { id: productId },
        data: {
          images: final,
          imageUrl: imageUrl ?? existing.imageUrl ?? (final[0] ?? null),
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
