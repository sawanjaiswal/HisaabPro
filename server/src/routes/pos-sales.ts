/**
 * POS Sales Routes — POST /sales, GET /sales, GET /sales/:id,
 *   POST /sales/:id/void, POST /sales/:id/restore
 * Mounted by pos.ts under /api/pos
 */

import { Router } from 'express'
import type { Request } from 'express'
import { z } from 'zod'
import { auth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requirePermission } from '../middleware/permission.js'
import { requireIdempotencyKey } from '../middleware/requireIdempotencyKey.js'
import { sendSuccess } from '../lib/response.js'
import { prisma } from '../lib/prisma.js'
import { createPosSale } from '../services/pos/pos-checkout.service.js'
import { listPosSales, getPosSale } from '../services/pos/pos-query.service.js'
import { voidPosSale, restorePosSale } from '../services/pos/pos-void.service.js'
import { validateCreatePosSale } from '../services/pos/pos.validators.js'
import type { PosServiceCtx } from '../services/pos/pos.types.js'
import type { PosQueryCtx } from '../services/pos/pos-query.service.js'
import { idempotencyCheck } from '../middleware/idempotency.js'

const router = Router()

// ─── Query schema (GET /sales) ───────────────────────────────────────────────

const listSalesQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    cashierId: z.string().optional(),
    paymentMode: z.string().optional(),
    status: z.enum(['ACTIVE', 'VOIDED']).optional(),
  })
  .strict()

// ─── Void body schema ────────────────────────────────────────────────────────

const voidBodySchema = z
  .object({
    reason: z.string().min(3, 'reason must be at least 3 characters'),
  })
  .strict()

// ─── Context helpers ─────────────────────────────────────────────────────────

function getPosCtx(req: Request): PosServiceCtx {
  const user = req.user!
  return { businessId: user.businessId, userId: user.userId }
}

function getPosQueryCtx(req: Request): PosQueryCtx {
  const user = req.user!
  return { businessId: user.businessId, userId: user.userId, role: 'staff' }
}

// ─── POST /sales ──────────────────────────────────────────────────────────────

router.post(
  '/',
  auth,
  requireIdempotencyKey,
  requirePermission('pos.create'),
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const ctx = getPosCtx(req)
    const input = validateCreatePosSale(req.body)
    const dto = await createPosSale(ctx, input)
    sendSuccess(res, dto, 201)
  })
)

// ─── GET /sales ───────────────────────────────────────────────────────────────

router.get(
  '/',
  auth,
  requirePermission('pos.read'),
  asyncHandler(async (req, res) => {
    const ctx = getPosQueryCtx(req)
    const query = listSalesQuerySchema.parse(req.query)
    const result = await listPosSales(ctx, query)
    sendSuccess(res, result)
  })
)

// ─── GET /sales/:id ───────────────────────────────────────────────────────────

router.get(
  '/:id',
  auth,
  requirePermission('pos.read'),
  asyncHandler(async (req, res) => {
    const ctx = getPosQueryCtx(req)
    const dto = await getPosSale(ctx, String(req.params.id))
    sendSuccess(res, dto)
  })
)

// ─── POST /sales/:id/void ────────────────────────────────────────────────────

router.post(
  '/:id/void',
  auth,
  requirePermission('pos.void'),
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const ctx = getPosCtx(req)
    const { reason } = voidBodySchema.parse(req.body)
    const result = await voidPosSale(prisma, ctx, String(req.params.id), reason)
    sendSuccess(res, result)
  })
)

// ─── POST /sales/:id/restore ─────────────────────────────────────────────────

router.post(
  '/:id/restore',
  auth,
  requirePermission('pos.void'),
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const ctx = getPosCtx(req)
    const result = await restorePosSale(prisma, ctx, String(req.params.id))
    sendSuccess(res, result)
  })
)

export default router
