/**
 * POS Products & Receipt Routes
 *   GET /products — product grid
 *   POST /receipt/:id/share — signed share link
 * Mounted by pos.ts under /api/pos
 */

import { Router } from 'express'
import type { Request } from 'express'
import { z } from 'zod'
import { auth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requirePermission } from '../middleware/permission.js'
import { sendSuccess } from '../lib/response.js'
import { listPosProducts } from '../services/pos/pos-products.service.js'
import { buildShareLink } from '../services/pos/pos-receipt-share.service.js'
import type { PosServiceCtx } from '../services/pos/pos.types.js'

const router = Router()

// ─── Query schema (GET /products) ────────────────────────────────────────────

const listProductsQuerySchema = z
  .object({
    search: z.string().min(1).optional(),
    categoryId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    cursor: z.string().optional(),
    includeOutOfStock: z
      .union([z.literal('true'), z.literal('false'), z.boolean()])
      .transform(v => v === true || v === 'true')
      .optional(),
  })
  .strict()

// ─── Share body schema ───────────────────────────────────────────────────────

const shareBodySchema = z
  .object({
    channel: z.enum(['WHATSAPP', 'EMAIL']),
  })
  .strict()

// ─── Context helper ──────────────────────────────────────────────────────────

function getPosCtx(req: Request): PosServiceCtx {
  const user = req.user!
  return { businessId: user.businessId, userId: user.userId }
}

// ─── GET /products ───────────────────────────────────────────────────────────

router.get(
  '/products',
  auth,
  requirePermission('pos.read'),
  asyncHandler(async (req, res) => {
    const ctx = getPosCtx(req)
    const query = listProductsQuerySchema.parse(req.query)
    const result = await listPosProducts(ctx, query)
    sendSuccess(res, result)
  })
)

// ─── POST /receipt/:id/share ─────────────────────────────────────────────────

router.post(
  '/receipt/:id/share',
  auth,
  requirePermission('pos.read'),
  asyncHandler(async (req, res) => {
    const ctx = getPosCtx(req)
    const { channel } = shareBodySchema.parse(req.body)
    const result = await buildShareLink(ctx, String(req.params.id), { channel })
    sendSuccess(res, result)
  })
)

export default router
