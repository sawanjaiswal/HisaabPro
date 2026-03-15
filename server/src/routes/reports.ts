/**
 * Report Routes — Invoice, Party Statement, Stock Summary, Day Book, Payment History
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { resolveBusinessId } from '../lib/business.js'
import {
  invoiceReportSchema,
  partyStatementSchema,
  stockSummarySchema,
  dayBookSchema,
  paymentHistorySchema,
} from '../schemas/report.schemas.js'
import * as reportService from '../services/report.service.js'

const router = Router()

router.use(auth)

/** GET /api/reports/invoices — Invoice report (sale/purchase) */
router.get(
  '/invoices',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const query = invoiceReportSchema.parse(req.query)
    const result = await reportService.getInvoiceReport(businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/reports/party-statement/:partyId — Party ledger statement */
router.get(
  '/party-statement/:partyId',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const query = partyStatementSchema.parse(req.query)
    const result = await reportService.getPartyStatement(
      businessId, String(req.params.partyId), query
    )
    sendSuccess(res, result)
  })
)

/** GET /api/reports/stock-summary — Stock summary report */
router.get(
  '/stock-summary',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const query = stockSummarySchema.parse(req.query)
    const result = await reportService.getStockSummary(businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/reports/day-book — Day book report */
router.get(
  '/day-book',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const query = dayBookSchema.parse(req.query)
    const result = await reportService.getDayBook(businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/reports/payments — Payment history report */
router.get(
  '/payments',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const query = paymentHistorySchema.parse(req.query)
    const result = await reportService.getPaymentHistory(businessId, query)
    sendSuccess(res, result)
  })
)

export default router
