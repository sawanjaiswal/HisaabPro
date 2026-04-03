/**
 * Financial Reports Routes
 * All routes require auth. businessId resolved from user's active BusinessUser record.
 *
 * GET query params are parsed manually via Zod (validate() middleware only handles req.body).
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { requirePlan } from '../middleware/subscription-gate.js'
import { sendSuccess } from '../lib/response.js'
import {
  periodQuerySchema,
  balanceSheetQuerySchema,
  agingQuerySchema,
  profitabilityQuerySchema,
  cashFlowQuerySchema,
  tallyExportQuerySchema,
  discountQuerySchema,
} from '../schemas/financial-reports.schemas.js'
import * as reportService from '../services/financial-reports.service.js'

const router = Router()

router.use(auth)

/** GET /api/financial-reports/profit-loss?from=&to= */
router.get(
  '/profit-loss',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { from, to } = periodQuerySchema.parse(req.query)
    const data = await reportService.getProfitAndLoss(businessId, from, to)
    sendSuccess(res, data)
  }),
)

/** GET /api/financial-reports/balance-sheet?asOf= */
router.get(
  '/balance-sheet',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { asOf } = balanceSheetQuerySchema.parse(req.query)
    const data = await reportService.getBalanceSheet(businessId, asOf)
    sendSuccess(res, data)
  }),
)

/** GET /api/financial-reports/cash-flow?from=&to= */
router.get(
  '/cash-flow',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { from, to } = cashFlowQuerySchema.parse(req.query)
    const data = await reportService.getCashFlowStatement(businessId, from, to)
    sendSuccess(res, data)
  }),
)

/** GET /api/financial-reports/aging?type=RECEIVABLE|PAYABLE&asOf= */
router.get(
  '/aging',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { type, asOf } = agingQuerySchema.parse(req.query)
    const data = await reportService.getAgingReport(businessId, type, asOf)
    sendSuccess(res, data)
  }),
)

/** GET /api/financial-reports/profitability?from=&to=&groupBy=PARTY|PRODUCT|DOCUMENT */
router.get(
  '/profitability',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { from, to, groupBy } = profitabilityQuerySchema.parse(req.query)
    const data = await reportService.getProfitabilityReport(businessId, from, to, groupBy)
    sendSuccess(res, data)
  }),
)

/** GET /api/financial-reports/discounts?from=&to= */
router.get(
  '/discounts',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { from, to } = discountQuerySchema.parse(req.query)
    const data = await reportService.getDiscountReport(businessId, from, to)
    sendSuccess(res, data)
  }),
)

/**
 * GET /api/financial-reports/tally-export?from=&to=
 * Returns Tally-compatible XML with content-type application/xml
 */
router.get(
  '/tally-export',
  requirePlan('BUSINESS'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { from, to } = tallyExportQuerySchema.parse(req.query)
    const xml = await reportService.getTallyExport(businessId, from, to)
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tally-export-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.xml"`,
    )
    res.status(200).send(xml)
  }),
)

export default router
