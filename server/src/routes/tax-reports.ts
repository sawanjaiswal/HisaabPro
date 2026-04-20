/**
 * Tax Report Routes — Tax Summary, HSN Summary, Tax Ledger
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { requireFeature } from '../middleware/subscription-gate.js'
import { sendSuccess } from '../lib/response.js'
import { taxSummarySchema, hsnSummarySchema, taxLedgerSchema } from '../schemas/report.schemas.js'
import * as taxReportService from '../services/tax-report.service.js'

const router = Router()
router.use(auth)
router.use(requireFeature('taxReports'))

/** GET /api/reports/tax-summary — Aggregated CGST/SGST/IGST/Cess */
router.get('/tax-summary', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const query = taxSummarySchema.parse(req.query)
  const result = await taxReportService.getTaxSummary(businessId, query)
  sendSuccess(res, result)
}))

/** GET /api/reports/hsn-summary — HSN-wise tax breakup */
router.get('/hsn-summary', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const query = hsnSummarySchema.parse(req.query)
  const result = await taxReportService.getHsnSummary(businessId, query)
  sendSuccess(res, result)
}))

/** GET /api/reports/tax-ledger — Individual document tax entries */
router.get('/tax-ledger', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const query = taxLedgerSchema.parse(req.query)
  const result = await taxReportService.getTaxLedger(businessId, query)
  sendSuccess(res, result)
}))

export default router
