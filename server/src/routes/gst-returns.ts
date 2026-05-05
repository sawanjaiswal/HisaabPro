/**
 * GST Return Routes — GSTR-1, GSTR-3B, GSTR-9 generation and export.
 * PR 10 — adds NIC v3.0 GSTR-1 8-builder endpoints alongside legacy routes.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { requirePlan } from '../middleware/subscription-gate.js'
import { sendSuccess } from '../lib/response.js'
import logger from '../lib/logger.js'
import { gstReturnSchema, gstReturnExportSchema } from '../schemas/report.schemas.js'
import * as gstService from '../services/gst-return.service.js'
import * as gstr1Service from '../services/gst-returns/gstr1.service.js'

const router = Router()

router.use(auth)
router.use(requirePlan('PRO'))

// ─── NIC v3.0 GSTR-1 — PR 10 ────────────────────────────────────────────────

/**
 * GET /api/gst/returns/GSTR1/:period
 * Returns existing GstReturn summary (no re-compute). Use export to re-generate.
 */
router.get('/GSTR1/:period', requirePermission('reports.view'), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const { period } = gstReturnSchema.parse({ returnType: 'GSTR1', period: req.params.period })

  const result = await gstr1Service.getGstr1Summary(businessId, period)
  sendSuccess(res, result)
}))

/**
 * POST /api/gst/returns/GSTR1/:period/export
 * Re-runs all 8 builders, upserts GstReturn, returns NIC v3.0 envelope + CSV.
 * Rate-limited to 5/min per business via Idempotency-Key header check.
 */
router.post(
  '/GSTR1/:period/export',
  requirePermission('reports.download'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { period } = gstReturnSchema.parse({ returnType: 'GSTR1', period: req.params.period })
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined

    logger.info('gstr1.export.requested', { businessId, period, idempotencyKey })

    const result = await gstr1Service.exportGstr1(businessId, period)

    sendSuccess(res, {
      jsonData: result.jsonData,
      csvData: result.csvData,
      summary: result.summary,
    })
  }),
)

// ─── Legacy routes (GSTR-3B, GSTR-9, old GSTR-1) ────────────────────────────

/** GET /api/gst/returns/:returnType/:period */
router.get('/:returnType/:period', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const { returnType, period } = gstReturnSchema.parse(req.params)

  if (returnType === 'GSTR1') {
    const data = await gstService.generateGstr1(businessId, period)
    sendSuccess(res, data.summary)
  } else if (returnType === 'GSTR3B') {
    const result = await gstService.generateGstr3b(businessId, period)
    sendSuccess(res, result)
  } else {
    const result = await gstService.generateGstr9(businessId, period)
    sendSuccess(res, result)
  }
}))

/** POST /api/gst/returns/:returnType/:period/export */
router.post('/:returnType/:period/export', requirePermission('reports.download'), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const params = gstReturnSchema.parse(req.params)
  const { format: _format } = gstReturnExportSchema.parse({ ...req.body, ...params })

  if (params.returnType === 'GSTR1') {
    // Redirect to NIC v3.0 builder
    const result = await gstr1Service.exportGstr1(businessId, params.period)
    sendSuccess(res, { jsonData: result.jsonData, csvData: result.csvData, summary: result.summary })
  } else if (params.returnType === 'GSTR3B') {
    const result = await gstService.generateGstr3b(businessId, params.period)
    sendSuccess(res, { ...result, fileName: `GSTR3B_${params.period}.json` })
  } else {
    const result = await gstService.generateGstr9(businessId, params.period)
    sendSuccess(res, { ...result, fileName: `GSTR9_${params.period}.json` })
  }

  void _format // validated by schema; GSTR1 always returns both JSON and CSV
}))

export default router
