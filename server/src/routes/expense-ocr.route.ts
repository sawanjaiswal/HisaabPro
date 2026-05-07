/**
 * Expense OCR Routes
 * Mount: under /api/expenses (see expenses.ts)
 * Rate-limited: 10 OCR calls per minute per business.
 * No image bytes are stored. Base64 JSON body capped at 8 MB JSON envelope.
 */

import { Router } from 'express'
import express from 'express'
import crypto from 'crypto'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requirePermission } from '../middleware/permission.js'
import { createRateLimiter } from '../middleware/rate-limit.js'
import { sendSuccess } from '../lib/response.js'
import { parseReceipt } from '../services/expense/expense-ocr.service.js'

const router = Router()

// Override JSON limit for OCR route — base64 JPEG of 5 MB decodes to ~6.7 MB base64
// Use 8 MB to give headroom; route's own size check rejects > 5 MB decoded.
const ocrJsonParser = express.json({ limit: '8mb' })

/** Per-business OCR rate limiter: max 10 requests / minute */
const ocrRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 10,
  message: 'OCR rate limit exceeded — max 10 requests per minute per business',
  keyFn: (req) => `ocr:${req.user?.businessId ?? req.ip ?? 'unknown'}`,
  eventName: 'OCR_RATE_LIMITED',
})

/**
 * POST /ocr — parse receipt image via Anthropic Vision (200)
 * Body: { base64Image: string, mimeType: "image/jpeg"|"image/png"|"image/webp" }
 * Returns: { amountPaise, vendor, date, suggestedCategoryId, confidence, sourceHash }
 */
router.post(
  '/',
  ocrJsonParser,
  ocrRateLimiter,
  requirePermission('accounting.create'),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!
    const { base64Image, mimeType } = req.body as {
      base64Image?: unknown
      mimeType?: unknown
    }

    if (!base64Image || typeof base64Image !== 'string' || base64Image.trim() === '') {
      res.status(400).json({
        success: false,
        error: { code: 'IMAGE_REQUIRED', message: 'base64Image is required' },
      })
      return
    }

    if (!mimeType || typeof mimeType !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'MIME_TYPE_REQUIRED', message: 'mimeType is required' },
      })
      return
    }

    // Compute SHA-256 of base64 string — unique identifier for dedup without storing bytes
    const sourceHash = crypto.createHash('sha256').update(base64Image).digest('hex')

    const result = await parseReceipt({
      businessId,
      base64Image,
      mimeType,
      sourceHash,
    })

    sendSuccess(res, { ...result, sourceHash })
  }),
)

export default router
