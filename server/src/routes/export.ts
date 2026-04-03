/**
 * Data export routes — CSV download of all business data.
 * Owner-only. Rate limited to 1 per day.
 *
 * GET /api/export/full — returns JSON with CSV strings per entity
 */

import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { asyncHandler } from '../lib/async-handler.js'
import { generateFullExport } from '../services/export.service.js'

const router = Router()

router.use(auth)

/** Full business data export — all entities as CSV */
router.get('/full', asyncHandler(async (req, res) => {
  const result = await generateFullExport(req.user!.businessId)

  // Set headers for download
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="hisaabpro-export-${Date.now()}.json"`)

  sendSuccess(res, result)
}))

/** Individual entity CSV download */
router.get('/csv/:entity', asyncHandler(async (req, res) => {
  const { entity } = req.params
  const validEntities = ['parties', 'products', 'documents', 'payments', 'expenses']

  if (!validEntities.includes(entity)) {
    return sendError(res, `Invalid entity: ${entity}. Valid: ${validEntities.join(', ')}`, 'VALIDATION_ERROR', 400)
  }

  const result = await generateFullExport(req.user!.businessId)
  const csv = result[entity as keyof typeof result]

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${entity}-${Date.now()}.csv"`)
  res.send(csv)
}))

export default router
