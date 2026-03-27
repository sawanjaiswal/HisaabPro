/**
 * Report Routes — Invoice, Party Statement, Stock Summary, Day Book, Payment History
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { sendSuccess } from '../lib/response.js'
import {
  invoiceReportSchema,
  partyStatementSchema,
  stockSummarySchema,
  dayBookSchema,
  paymentHistorySchema,
  exportReportSchema,
} from '../schemas/report.schemas.js'
import * as reportService from '../services/report.service.js'

const router = Router()

/** Sanitize file name for Content-Disposition header (prevent header injection) */
function sanitizeFileName(name: string): string {
  return name.replace(/[^\w\s.-]/g, '_').slice(0, 100)
}

router.use(auth)

/** GET /api/reports/invoices — Invoice report (sale/purchase) */
router.get(
  '/invoices',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = invoiceReportSchema.parse(req.query)
    const result = await reportService.getInvoiceReport(businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/reports/party-statement/:partyId — Party ledger statement */
router.get(
  '/party-statement/:partyId',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
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
    const businessId = req.user!.businessId
    const query = stockSummarySchema.parse(req.query)
    const result = await reportService.getStockSummary(businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/reports/day-book — Day book report */
router.get(
  '/day-book',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = dayBookSchema.parse(req.query)
    const result = await reportService.getDayBook(businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/reports/payments — Payment history report */
router.get(
  '/payments',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = paymentHistorySchema.parse(req.query)
    const result = await reportService.getPaymentHistory(businessId, query)
    sendSuccess(res, result)
  })
)

/** POST /api/reports/export — Export report as CSV */
router.post(
  '/export',
  requirePermission('reports.download'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const body = exportReportSchema.parse(req.body)
    const result = await reportService.exportReport(
      businessId, body.reportType, body.filters
    )
    // For CSV, return as downloadable file
    if (body.format === 'CSV') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFileName(result.fileName)}"`)

      res.send(result.csv)
    } else {
      // PDF export — Phase 2
      sendSuccess(res, {
        message: 'PDF export coming soon. Use CSV for now.',
        fileName: result.fileName,
        rowCount: result.rowCount,
      })
    }
  })
)

export default router
