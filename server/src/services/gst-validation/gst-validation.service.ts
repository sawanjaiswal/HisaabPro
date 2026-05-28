/**
 * GST filing-readiness service (#144). Fetches a period's sale/note documents
 * (mirroring the GSTR-1 builder query), runs the pure rules, and assembles a
 * GstFilingReadiness verdict. Read-only — never mutates documents.
 */

import { prisma } from '../../lib/prisma.js'
import { parsePeriod } from '../gst-returns/period.utils.js'
import { runGstRules } from './gst-rules.js'
import type {
  CheckContext,
  CheckDoc,
  GstCheck,
  GstFilingReadiness,
} from './gst-validation.types.js'

/** Doc types that flow into GSTR-1 / GSTR-3B outward supplies. */
const RETURN_DOC_TYPES = ['SALE_INVOICE', 'DEBIT_NOTE', 'CREDIT_NOTE'] as const

export async function getFilingReadiness(
  businessId: string,
  period: string,
  returnType: 'GSTR1' | 'GSTR3B',
): Promise<GstFilingReadiness> {
  const [start, end] = parsePeriod(period)

  const [business, rows] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { stateCode: true, compositionScheme: true },
    }),
    prisma.document.findMany({
      where: {
        businessId,
        type: { in: [...RETURN_DOC_TYPES] },
        documentDate: { gte: start, lt: end },
        status: 'SAVED',
        deletedAt: null,
      },
      select: {
        id: true,
        documentNumber: true,
        supplyType: true,
        placeOfSupply: true,
        totalCgst: true,
        totalSgst: true,
        totalIgst: true,
        party: { select: { gstin: true } },
        lineItems: {
          select: {
            hsnCode: true,
            sacCode: true,
            taxableValue: true,
            cgstRate: true,
            sgstRate: true,
            igstRate: true,
          },
        },
      },
    }),
  ])

  const docs: CheckDoc[] = rows.map((r) => ({
    id: r.id,
    documentNumber: r.documentNumber ?? r.id,
    supplyType: r.supplyType,
    placeOfSupply: r.placeOfSupply,
    totalCgst: r.totalCgst,
    totalSgst: r.totalSgst,
    totalIgst: r.totalIgst,
    partyGstin: r.party?.gstin ?? null,
    lines: r.lineItems.map((l) => ({
      hsnCode: l.hsnCode,
      sacCode: l.sacCode,
      taxableValue: l.taxableValue,
      cgstRate: l.cgstRate,
      sgstRate: l.sgstRate,
      igstRate: l.igstRate,
    })),
  }))

  const ctx: CheckContext = {
    businessStateCode: business?.stateCode ?? null,
    businessComposition: business?.compositionScheme ?? false,
  }

  const results = runGstRules(docs, ctx)

  const checks: GstCheck[] = results.map((r) => ({
    id: r.id,
    severity: r.severity,
    count: r.count,
    documents: r.documents,
  }))

  const blockerCount = checks.filter((c) => c.severity === 'blocker').length
  const warningCount = checks.filter((c) => c.severity === 'warning').length

  return {
    period,
    returnType,
    documentsScanned: docs.length,
    checks,
    blockerCount,
    warningCount,
    readyToFile: blockerCount === 0,
  }
}
