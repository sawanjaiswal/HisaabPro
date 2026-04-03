/**
 * GST Return Routes — GSTR-1, GSTR-3B, GSTR-9 generation and export
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { requirePlan } from '../middleware/subscription-gate.js'
import { sendSuccess } from '../lib/response.js'
import { gstReturnSchema, gstReturnExportSchema } from '../schemas/report.schemas.js'
import * as gstService from '../services/gst-return.service.js'
import * as gstSettings from '../services/gst-settings.service.js'

const router = Router()

/** Sanitize file name for Content-Disposition header (prevent header injection) */
function sanitizeFileName(name: string): string {
  return name.replace(/[^\w\s.-]/g, '_').slice(0, 100)
}

router.use(auth)
router.use(requirePlan('PRO'))

/** GET /api/gst/returns/:returnType/:period — Generate return summary */
router.get('/:returnType/:period', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const { returnType, period } = gstReturnSchema.parse(req.params)

  let result
  if (returnType === 'GSTR1') {
    const data = await gstService.generateGstr1(businessId, period)
    result = data.summary
  } else if (returnType === 'GSTR3B') {
    result = await gstService.generateGstr3b(businessId, period)
  } else {
    result = await gstService.generateGstr9(businessId, period)
  }

  sendSuccess(res, result)
}))

/** POST /api/gst/returns/:returnType/:period/export — Export as JSON/CSV */
router.post('/:returnType/:period/export', requirePermission('reports.download'), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const params = gstReturnSchema.parse(req.params)
  const { format } = gstReturnExportSchema.parse({ ...req.body, ...params })

  if (params.returnType === 'GSTR1' && format === 'JSON') {
    const result = await gstService.exportGstr1Json(businessId, params.period)
    // Inject GSTIN from business settings
    const settings = await gstSettings.getGstSettings(businessId)
    result.json.gstin = settings.gstin ?? ''

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFileName(result.fileName)}"`)

    sendSuccess(res, result)
  } else if (params.returnType === 'GSTR3B') {
    const result = await gstService.generateGstr3b(businessId, params.period)
    sendSuccess(res, { ...result, fileName: `GSTR3B_${params.period}.json` })
  } else {
    const result = await gstService.generateGstr9(businessId, params.period)
    sendSuccess(res, { ...result, fileName: `GSTR9_${params.period}.json` })
  }
}))

export default router
