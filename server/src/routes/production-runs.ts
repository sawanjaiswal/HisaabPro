/**
 * Production Run Routes — /api/production-runs
 *
 * GET  /api/production-runs             — list (paginated, filterable)
 * GET  /api/production-runs/:id         — get detail
 * POST /api/production-runs             — execute (X-Idempotency-Key required)
 * POST /api/production-runs/:id/cancel  — cancel COMPLETED run
 */

import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requirePermission } from '../middleware/permission.js'
import { requireIdempotencyKey } from '../middleware/requireIdempotencyKey.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { listProductionRuns, getProductionRun } from '../services/bom/production-run.service.js'
import { executeProductionRun } from '../services/bom/production-run-execute.service.js'
import { cancelProductionRun } from '../services/bom/production-run-cancel.service.js'
import {
  createProductionRunSchema,
  listProductionRunQuerySchema,
} from '../schemas/bom/production-run.schemas.js'
import { idempotencyCheck } from '../middleware/idempotency.js'

const router = Router()

// ─── GET /api/production-runs ─────────────────────────────────────────────────

router.get(
  '/',
  auth,
  requirePermission('bom.read'),
  asyncHandler(async (req, res) => {
    const parsed = listProductionRunQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      sendError(res, parsed.error.errors[0]?.message ?? 'Invalid query', 'VALIDATION_ERROR', 400)
      return
    }
    const { businessId } = req.user!
    const result = await listProductionRuns(businessId, parsed.data)
    res.status(200).json({ success: true, ...result })
  })
)

// ─── GET /api/production-runs/:id ─────────────────────────────────────────────

router.get(
  '/:id',
  auth,
  requirePermission('bom.read'),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!
    try {
      const detail = await getProductionRun(String(req.params.id), businessId)
      sendSuccess(res, detail)
    } catch (err: unknown) {
      const e = err as { code: string; message: string; status: number }
      sendError(res, e.message, e.code, e.status)
    }
  })
)

// ─── POST /api/production-runs ────────────────────────────────────────────────

router.post(
  '/',
  auth,
  requireIdempotencyKey,
  requirePermission('production.run'),
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const idempotencyKey = req.idempotencyKey
    if (!idempotencyKey) {
      sendError(res, 'X-Idempotency-Key header is required', 'MISSING_IDEMPOTENCY_KEY', 400)
      return
    }

    const parsed = createProductionRunSchema.safeParse(req.body)
    if (!parsed.success) {
      sendError(res, parsed.error.errors[0]?.message ?? 'Validation error', 'VALIDATION_ERROR', 400)
      return
    }

    const { businessId, userId } = req.user!
    const { bomId, quantityProduced, runDate, notes } = parsed.data

    try {
      const detail = await executeProductionRun({
        businessId,
        bomId,
        quantityProduced,
        runDate: new Date(runDate),
        notes,
        userId,
        idempotencyKey,
      })
      res.status(201).json({
        success: true,
        data: detail,
        warnings: detail.warnings,
      })
    } catch (err: unknown) {
      const e = err as { code: string; message: string; status: number; details?: unknown }
      if (e.details) {
        res.status(e.status).json({
          success: false,
          error: { code: e.code, message: e.message, details: e.details },
        })
      } else {
        sendError(res, e.message, e.code, e.status)
      }
    }
  })
)

// ─── POST /api/production-runs/:id/cancel ─────────────────────────────────────

router.post(
  '/:id/cancel',
  auth,
  requirePermission('production.run'),
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    try {
      const result = await cancelProductionRun({ businessId, runId: String(req.params.id), userId })
      sendSuccess(res, result)
    } catch (err: unknown) {
      const e = err as { code: string; message: string; status: number }
      sendError(res, e.message, e.code, e.status)
    }
  })
)

export default router
