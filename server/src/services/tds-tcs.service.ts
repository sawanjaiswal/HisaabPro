/**
 * TDS/TCS Service — Tax Deducted/Collected at Source
 * Tracking deductions on B2B invoices, separate ledger, summary report.
 * All amounts in PAISE, rates in BASIS POINTS.
 */

import { prisma } from '../lib/prisma.js'
import type { TdsTcsSummaryQuery } from '../schemas/report.schemas.js'

// ─── Pure calculation helpers ──────────────────────────────────────────────

/**
 * Calculate TDS amount from grand total.
 * @param grandTotalPaise  Invoice total in paise
 * @param tdsRateBp        TDS rate in basis points (e.g. 100 = 1%)
 */
export function calculateTds(grandTotalPaise: number, tdsRateBp: number): number {
  if (tdsRateBp <= 0 || grandTotalPaise <= 0) return 0
  return Math.round((grandTotalPaise * tdsRateBp) / 10000)
}

/**
 * Calculate TCS amount from grand total.
 * @param grandTotalPaise  Invoice total in paise
 * @param tcsRateBp        TCS rate in basis points (e.g. 100 = 1%)
 */
export function calculateTcs(grandTotalPaise: number, tcsRateBp: number): number {
  if (tcsRateBp <= 0 || grandTotalPaise <= 0) return 0
  return Math.round((grandTotalPaise * tcsRateBp) / 10000)
}

// ─── Report query ──────────────────────────────────────────────────────────

export interface TdsTcsEntry {
  documentId: string
  documentNumber: string | null
  documentDate: Date
  partyId: string
  partyName: string
  grandTotal: number
  tdsRate: number
  tdsAmount: number
  tcsRate: number
  tcsAmount: number
}

export interface TdsTcsSummaryResult {
  entries: TdsTcsEntry[]
  totals: {
    totalInvoiceValue: number
    totalTdsAmount: number
    totalTcsAmount: number
    invoiceCount: number
  }
  period: { from: string; to: string }
}

/**
 * Aggregate TDS/TCS deductions for a business across a date range.
 * Filters by partyId and/or type (tds|tcs|all) if provided.
 */
export async function getTdsTcsReport(
  businessId: string,
  query: TdsTcsSummaryQuery,
): Promise<TdsTcsSummaryResult> {
  const from = new Date(query.from)
  const to = new Date(query.to)
  to.setHours(23, 59, 59, 999)

  const where: Record<string, unknown> = {
    businessId,
    status: { in: ['SAVED', 'SHARED'] },
    type: { in: ['SALE_INVOICE', 'PURCHASE_INVOICE'] },
    documentDate: { gte: from, lte: to },
    deletedAt: null,
  }

  if (query.partyId) {
    where.partyId = query.partyId
  }

  // Filter to only documents with relevant deductions
  if (query.type === 'tds') {
    where.tdsAmount = { gt: 0 }
  } else if (query.type === 'tcs') {
    where.tcsAmount = { gt: 0 }
  } else {
    // 'all' — only include docs with any TDS or TCS
    where.OR = [{ tdsAmount: { gt: 0 } }, { tcsAmount: { gt: 0 } }]
  }

  const docs = await prisma.document.findMany({
    where,
    select: {
      id: true,
      documentNumber: true,
      documentDate: true,
      grandTotal: true,
      tdsRate: true,
      tdsAmount: true,
      tcsRate: true,
      tcsAmount: true,
      party: { select: { id: true, name: true } },
    },
    orderBy: { documentDate: 'asc' },
    take: 5000, // report: bounded by date range filter
  })

  let totalInvoiceValue = 0
  let totalTdsAmount = 0
  let totalTcsAmount = 0

  const entries: TdsTcsEntry[] = docs.map(doc => {
    totalInvoiceValue += doc.grandTotal
    totalTdsAmount += doc.tdsAmount
    totalTcsAmount += doc.tcsAmount
    return {
      documentId: doc.id,
      documentNumber: doc.documentNumber,
      documentDate: doc.documentDate,
      partyId: doc.party.id,
      partyName: doc.party.name,
      grandTotal: doc.grandTotal,
      tdsRate: doc.tdsRate,
      tdsAmount: doc.tdsAmount,
      tcsRate: doc.tcsRate,
      tcsAmount: doc.tcsAmount,
    }
  })

  return {
    entries,
    totals: {
      totalInvoiceValue,
      totalTdsAmount,
      totalTcsAmount,
      invoiceCount: docs.length,
    },
    period: { from: query.from, to: query.to },
  }
}
