/**
 * GSTR-3B Service — 11-row monthly summary aggregator.
 *
 * Sections per spec §12.1:
 *   3.1(a) Outward taxable (non-RCM, non-nil)        3.1(b) Exports/SEZ
 *   3.1(c) Nil-rated/exempt outward                  3.1(d) Inward RCM
 *   3.1(e) Non-GST outward (default 0)               3.2    B2C Large state-wise (default 0)
 *   4      ITC from purchases                         4(D)   ITC reversed (default 0)
 *   5      Exempt inward supplies                     6.1    Net tax payable
 *   LateFee (default 0)
 *
 * All amounts stored in paise. Converted at export boundary via paiseToRupeesForNic.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { parsePeriod } from './period.utils.js'
import { paiseToRupeesForNic } from './gstr1.service.js'
import { generateGstr3bCsv } from './gstr3b-csv.js'

export interface Gstr3bSection {
  section: string
  description: string
  taxableValue: number
  cgst: number
  sgst: number
  igst: number
  cess: number
}

export interface Gstr3bSummary {
  period: string
  sections: Gstr3bSection[]
  netPayable: number
}

export interface Gstr3bResult {
  jsonData: Gstr3bSummary
  csvData: string
  summary: Gstr3bSummary
}

// ─── Internal aggregate shape ────────────────────────────────────────────────

interface TaxAgg {
  taxableValue: number
  cgst: number
  sgst: number
  igst: number
  cess: number
}

function empty(): TaxAgg {
  return { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 }
}

type PrismaAgg = {
  _sum: {
    totalTaxableValue: number | null
    totalCgst: number | null
    totalSgst: number | null
    totalIgst: number | null
    totalCess: number | null
  }
}

function lift(agg: PrismaAgg): TaxAgg {
  const s = agg._sum
  return {
    taxableValue: Number(s.totalTaxableValue ?? 0),
    cgst: Number(s.totalCgst ?? 0),
    sgst: Number(s.totalSgst ?? 0),
    igst: Number(s.totalIgst ?? 0),
    cess: Number(s.totalCess ?? 0),
  }
}

function totalTax(a: TaxAgg): number {
  return a.cgst + a.sgst + a.igst + a.cess
}

function sec(section: string, description: string, a: TaxAgg): Gstr3bSection {
  return { section, description, taxableValue: a.taxableValue, cgst: a.cgst, sgst: a.sgst, igst: a.igst, cess: a.cess }
}

// ─── Aggregation queries ─────────────────────────────────────────────────────

async function fetchAggregates(businessId: string, start: Date, end: Date) {
  const base = {
    businessId,
    isDeleted: false,
    documentDate: { gte: start, lt: end },
    status: { notIn: ['DRAFT', 'DELETED'] },
  }
  const sums = { _sum: { totalTaxableValue: true, totalCgst: true, totalSgst: true, totalIgst: true, totalCess: true } } as const

  const [agg31a, agg31b, agg31d, agg4, agg5, agg31c] = await Promise.all([
    prisma.document.aggregate({ where: { ...base, type: 'SALE_INVOICE', supplyType: { in: ['B2B', 'B2C_LARGE', 'B2C_SMALL'] }, isReverseCharge: false, totalCgst: { gt: 0 } }, ...sums }),
    prisma.document.aggregate({ where: { ...base, type: 'SALE_INVOICE', supplyType: { in: ['EXPORT', 'SEZ'] } }, ...sums }),
    prisma.document.aggregate({ where: { ...base, type: 'PURCHASE_INVOICE', isReverseCharge: true }, ...sums }),
    prisma.document.aggregate({ where: { ...base, type: 'PURCHASE_INVOICE', isReverseCharge: false, totalCgst: { gt: 0 } }, ...sums }),
    prisma.document.aggregate({ where: { ...base, type: 'PURCHASE_INVOICE', totalCgst: 0, totalSgst: 0, totalIgst: 0 }, ...sums }),
    prisma.document.aggregate({ where: { ...base, type: 'SALE_INVOICE', totalCgst: 0, totalSgst: 0, totalIgst: 0 }, ...sums }),
  ])

  return {
    s31a: lift(agg31a),
    s31b: lift(agg31b),
    s31c: lift(agg31c),
    s31d: lift(agg31d),
    s4:   lift(agg4),
    s5:   lift(agg5),
  }
}

// ─── Main aggregator ────────────────────────────────────────────────────────

export async function computeGstr3b(
  businessId: string,
  period: string,
): Promise<Gstr3bSummary> {
  const [start, end] = parsePeriod(period)
  const { s31a, s31b, s31c, s31d, s4, s5 } = await fetchAggregates(businessId, start, end)

  // Defaults (no schema field; manual override in UI)
  const s31e = empty()
  const s32  = empty()
  const s4d  = empty()
  const sLateFee = empty()

  const outwardTax = totalTax(s31a) + totalTax(s31b) + totalTax(s31d)
  const itcCredit  = totalTax(s4) - totalTax(s4d)
  const netPayable = Math.max(0, outwardTax - itcCredit)

  const sections: Gstr3bSection[] = [
    sec('3.1(a)', 'Outward taxable supplies (non-RCM)', s31a),
    sec('3.1(b)', 'Outward taxable supplies (exports/SEZ)', s31b),
    sec('3.1(c)', 'Outward supplies — nil-rated/exempt', s31c),
    sec('3.1(d)', 'Inward supplies liable for RCM', s31d),
    sec('3.1(e)', 'Non-GST outward supplies', s31e),
    sec('3.2',    'State-wise B2C Large (IGST only)', s32),
    sec('4',      'ITC available (from purchases)', s4),
    sec('4(D)',   'ITC reversed', s4d),
    sec('5',      'Exempt inward supplies', s5),
    sec('6.1',    'Tax payable (outward tax – ITC)', {
      taxableValue: 0,
      cgst: Math.max(0, s31a.cgst + s31d.cgst - s4.cgst + s4d.cgst),
      sgst: Math.max(0, s31a.sgst + s31d.sgst - s4.sgst + s4d.sgst),
      igst: Math.max(0, s31a.igst + s31b.igst + s31d.igst - s4.igst + s4d.igst),
      cess: Math.max(0, s31a.cess + s31b.cess + s31d.cess - s4.cess + s4d.cess),
    }),
    sec('LateFee', 'Late fee (manual override)', sLateFee),
  ]

  return { period, sections, netPayable }
}

// ─── Export (upserts GstReturn row) ─────────────────────────────────────────

export async function exportGstr3b(
  businessId: string,
  period: string,
): Promise<Gstr3bResult> {
  logger.info('gstr3b.export.started', { businessId, period })

  const summaryPaise = await computeGstr3b(businessId, period)
  const rupesSummary = paiseToRupeesForNic(summaryPaise) as Gstr3bSummary
  const csvData = generateGstr3bCsv(rupesSummary)

  const totalTaxAll = summaryPaise.sections.reduce(
    (acc, s) => acc + s.cgst + s.sgst + s.igst + s.cess, 0,
  )
  const totalTaxableAll = summaryPaise.sections.reduce((a, s) => a + s.taxableValue, 0)

  await prisma.gstReturn.upsert({
    where: { businessId_period_returnType: { businessId, period, returnType: 'GSTR3B' } },
    create: {
      businessId, period, returnType: 'GSTR3B', status: 'EXPORTED',
      jsonData: rupesSummary as object, summary: rupesSummary as object,
      invoiceCount: summaryPaise.sections.filter(s => s.taxableValue > 0).length,
      totalTaxableValue: totalTaxableAll,
      totalTax: totalTaxAll,
    },
    update: {
      status: 'EXPORTED',
      jsonData: rupesSummary as object, summary: rupesSummary as object,
      invoiceCount: summaryPaise.sections.filter(s => s.taxableValue > 0).length,
      totalTaxableValue: totalTaxableAll,
      totalTax: totalTaxAll,
      updatedAt: new Date(),
    },
  })

  logger.info('gstr3b.export.complete', { businessId, period, netPayable: summaryPaise.netPayable })
  return { jsonData: rupesSummary, csvData, summary: rupesSummary }
}

// ─── Read (no recompute) ────────────────────────────────────────────────────

export async function getGstr3bSummary(
  businessId: string,
  period: string,
): Promise<{ summary: Gstr3bSummary | null; exportedAt: Date | null }> {
  const existing = await prisma.gstReturn.findUnique({
    where: { businessId_period_returnType: { businessId, period, returnType: 'GSTR3B' } },
    select: { summary: true, updatedAt: true },
  })
  if (!existing) return { summary: null, exportedAt: null }
  return {
    summary: existing.summary as unknown as Gstr3bSummary,
    exportedAt: existing.updatedAt,
  }
}
