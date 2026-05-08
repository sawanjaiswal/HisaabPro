/**
 * BOM Routes — /api/bom
 *
 * GET    /api/bom        — list (paginated, optional productId filter)
 * GET    /api/bom/:id    — get detail
 * POST   /api/bom        — create
 * PUT    /api/bom/:id    — update (in-place or version-bump)
 * DELETE /api/bom/:id    — soft delete
 */

import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requirePermission } from '../middleware/permission.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { listBoms, getBom, createBom } from '../services/bom/bom.service.js'
import { updateBom, deleteBom } from '../services/bom/bom-write.service.js'
import {
  createBomSchema,
  updateBomSchema,
  listBomQuerySchema,
} from '../schemas/bom/bom.schemas.js'

const router = Router()

// ─── GET /api/bom ─────────────────────────────────────────────────────────────

router.get(
  '/',
  auth,
  requirePermission('bom.read'),
  asyncHandler(async (req, res) => {
    const parsed = listBomQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      sendError(res, parsed.error.errors[0]?.message ?? 'Invalid query', 'VALIDATION_ERROR', 400)
      return
    }
    const { businessId } = req.user!
    const result = await listBoms(businessId, parsed.data)
    res.status(200).json({ success: true, ...result })
  })
)

// ─── GET /api/bom/:id ─────────────────────────────────────────────────────────

router.get(
  '/:id',
  auth,
  requirePermission('bom.read'),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!
    try {
      const detail = await getBom(String(req.params.id), businessId)
      sendSuccess(res, detail)
    } catch (err: unknown) {
      const e = err as { code: string; message: string; status: number }
      sendError(res, e.message, e.code, e.status)
    }
  })
)

// ─── POST /api/bom ────────────────────────────────────────────────────────────

router.post(
  '/',
  auth,
  requirePermission('bom.edit'),
  asyncHandler(async (req, res) => {
    const parsed = createBomSchema.safeParse(req.body)
    if (!parsed.success) {
      sendError(res, parsed.error.errors[0]?.message ?? 'Validation error', 'VALIDATION_ERROR', 400)
      return
    }
    const { businessId, userId } = req.user!
    try {
      const detail = await createBom(businessId, userId, parsed.data)
      sendSuccess(res, detail, 201)
    } catch (err: unknown) {
      const e = err as { code: string; message: string; status: number }
      sendError(res, e.message, e.code, e.status)
    }
  })
)

// ─── PUT /api/bom/:id ────────────────────────────────────────────────────────

router.put(
  '/:id',
  auth,
  requirePermission('bom.edit'),
  asyncHandler(async (req, res) => {
    const parsed = updateBomSchema.safeParse(req.body)
    if (!parsed.success) {
      sendError(res, parsed.error.errors[0]?.message ?? 'Validation error', 'VALIDATION_ERROR', 400)
      return
    }
    const { businessId, userId } = req.user!
    try {
      const result = await updateBom(String(req.params.id), businessId, userId, parsed.data)
      const status = result.versioned ? 201 : 200
      res.status(status).json({ success: true, data: result, versioned: result.versioned })
    } catch (err: unknown) {
      const e = err as { code: string; message: string; status: number }
      sendError(res, e.message, e.code, e.status)
    }
  })
)

// ─── DELETE /api/bom/:id ──────────────────────────────────────────────────────

router.delete(
  '/:id',
  auth,
  requirePermission('bom.edit'),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    try {
      await deleteBom(String(req.params.id), businessId, userId)
      sendSuccess(res, { deleted: true })
    } catch (err: unknown) {
      const e = err as { code: string; message: string; status: number }
      sendError(res, e.message, e.code, e.status)
    }
  })
)

export default router
