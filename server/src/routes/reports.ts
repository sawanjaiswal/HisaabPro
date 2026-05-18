/**
 * Report Routes — Invoice, Party Statement, Stock Summary, Day Book, Payment History
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { requireActiveBusiness } from '../middleware/require-active-business.js'
import { requirePermission } from '../middleware/permission.js'
import { requireFeature } from '../middleware/subscription-gate.js'
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
import { getStockValueReport } from '../services/stock/value-report.service.js'

const router = Router()

/** Sanitize file name for Content-Disposition header (prevent header injection) */
function sanitizeFileName(name: string): string {
  return name.replace(/[^\w\s.-]/g, '_').slice(0, 100)
}

router.use(auth)
// Phase 6 #138 PR2 — tenancy gate.
router.use(requireActiveBusiness)
router.use(requireFeature('basicReports'))

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

/** GET /api/reports/stock-value — Weighted-avg stock value report (INV-04) */
router.get(
  '/stock-value',
  requirePermission('inventory.view'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    if (!businessId) {
      sendSuccess(res, {
        items: [],
        summary: { totalValuePaise: '0', productCount: 0 },
        nextCursor: null,
      })
      return
    }

    const cursor = req.query.cursor as string | undefined
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
    const categoryId = req.query.categoryId as string | undefined

    const report = await getStockValueReport(businessId, { cursor, limit, categoryId })

    sendSuccess(res, {
      items: report.items.map((item) => ({
        ...item,
        unitCostPaise: item.unitCostPaise.toString(),
        totalPaise: item.totalPaise.toString(),
        expiryDate: item.expiryDate ? item.expiryDate.toISOString() : null,
      })),
      summary: {
        totalValuePaise: report.totalValuePaise.toString(),
        productCount: report.productCount,
        asOf: report.asOf.toISOString(),
      },
      nextCursor: report.nextCursor,
    })
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
