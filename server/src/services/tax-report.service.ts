/**
 * Tax Report Service — Tax Summary, HSN Summary, Tax Ledger
 * All amounts in PAISE. Aggregates from saved documents with GST fields.
 */

import { prisma } from '../lib/prisma.js'
import type { TaxSummaryQuery, HsnSummaryQuery, TaxLedgerQuery } from '../schemas/report.schemas.js'

const TAXABLE_DOC_TYPES = ['SALE_INVOICE', 'PURCHASE_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE']

/** Tax Summary — aggregated CGST/SGST/IGST/Cess for a date range */
export async function getTaxSummary(businessId: string, query: TaxSummaryQuery) {
  const where = {
    businessId,
    status: 'SAVED',
    type: { in: TAXABLE_DOC_TYPES },
    documentDate: { gte: new Date(query.from), lte: new Date(query.to + 'T23:59:59.999Z') },
    deletedAt: null,
  }

  // Separate sales vs purchases for tax liability calculation
  const [sales, purchases, creditNotes, debitNotes] = await Promise.all([
    prisma.document.aggregate({
      where: { ...where, type: 'SALE_INVOICE' },
      _sum: { totalTaxableValue: true, totalCgst: true, totalSgst: true, totalIgst: true, totalCess: true, grandTotal: true },
      _count: true,
    }),
    prisma.document.aggregate({
      where: { ...where, type: 'PURCHASE_INVOICE' },
      _sum: { totalTaxableValue: true, totalCgst: true, totalSgst: true, totalIgst: true, totalCess: true, grandTotal: true },
      _count: true,
    }),
    prisma.document.aggregate({
      where: { ...where, type: 'CREDIT_NOTE' },
      _sum: { totalTaxableValue: true, totalCgst: true, totalSgst: true, totalIgst: true, totalCess: true, grandTotal: true },
      _count: true,
    }),
    prisma.document.aggregate({
      where: { ...where, type: 'DEBIT_NOTE' },
      _sum: { totalTaxableValue: true, totalCgst: true, totalSgst: true, totalIgst: true, totalCess: true, grandTotal: true },
      _count: true,
    }),
  ])

  const sum = (agg: typeof sales) => ({
    taxableValue: agg._sum.totalTaxableValue ?? 0,
    cgst: agg._sum.totalCgst ?? 0,
    sgst: agg._sum.totalSgst ?? 0,
    igst: agg._sum.totalIgst ?? 0,
    cess: agg._sum.totalCess ?? 0,
    total: agg._sum.grandTotal ?? 0,
    count: agg._count,
  })

  return {
    period: { from: query.from, to: query.to },
    sales: sum(sales),
    purchases: sum(purchases),
    creditNotes: sum(creditNotes),
    debitNotes: sum(debitNotes),
    netTaxLiability: {
      cgst: (sales._sum.totalCgst ?? 0) - (creditNotes._sum.totalCgst ?? 0),
      sgst: (sales._sum.totalSgst ?? 0) - (creditNotes._sum.totalSgst ?? 0),
      igst: (sales._sum.totalIgst ?? 0) - (creditNotes._sum.totalIgst ?? 0),
      cess: (sales._sum.totalCess ?? 0) - (creditNotes._sum.totalCess ?? 0),
    },
  }
}

/** HSN Summary — aggregated by HSN code across line items */
export async function getHsnSummary(businessId: string, query: HsnSummaryQuery) {
  const rows = await prisma.documentLineItem.groupBy({
    by: ['hsnCode'],
    where: {
      document: {
        businessId,
        status: 'SAVED',
        type: { in: ['SALE_INVOICE', 'CREDIT_NOTE'] },
        documentDate: { gte: new Date(query.from), lte: new Date(query.to + 'T23:59:59.999Z') },
        deletedAt: null,
      },
      hsnCode: { not: null },
    },
    _sum: { taxableValue: true, cgstAmount: true, sgstAmount: true, igstAmount: true, cessAmount: true, lineTotal: true },
    _count: true,
    orderBy: { _sum: { taxableValue: 'desc' } },
  })

  return {
    period: { from: query.from, to: query.to },
    items: rows.map((r) => ({
      hsnCode: r.hsnCode,
      quantity: r._count,
      taxableValue: r._sum.taxableValue ?? 0,
      cgst: r._sum.cgstAmount ?? 0,
      sgst: r._sum.sgstAmount ?? 0,
      igst: r._sum.igstAmount ?? 0,
      cess: r._sum.cessAmount ?? 0,
      totalValue: r._sum.lineTotal ?? 0,
    })),
  }
}

/** Tax Ledger — individual document tax entries, paginated */
export async function getTaxLedger(businessId: string, query: TaxLedgerQuery) {
  const where = {
    businessId,
    status: 'SAVED',
    type: { in: TAXABLE_DOC_TYPES },
    documentDate: { gte: new Date(query.from), lte: new Date(query.to + 'T23:59:59.999Z') },
    deletedAt: null,
  }

  const [entries, total] = await Promise.all([
    prisma.document.findMany({
      where,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit,
      orderBy: { documentDate: 'desc' },
      select: {
        id: true, type: true, documentNumber: true, documentDate: true,
        party: { select: { id: true, name: true } },
        totalTaxableValue: true, totalCgst: true, totalSgst: true, totalIgst: true, totalCess: true,
        grandTotal: true, placeOfSupply: true, isReverseCharge: true,
      },
    }),
    prisma.document.count({ where }),
  ])

  const nextCursor = entries.length === query.limit ? entries[entries.length - 1].id : null

  return {
    period: { from: query.from, to: query.to },
    entries,
    pagination: { total, nextCursor, limit: query.limit },
  }
}
