/**
 * GSTR-3B — Monthly Summary Return.
 * Aggregates outward supplies (RCM + non-RCM), ITC, and credit-note
 * adjustments to compute net tax payable.
 */

import { prisma } from '../../lib/prisma.js'
import { parsePeriod, savedDocWhere } from './helpers.js'

export async function generateGstr3b(businessId: string, period: string) {
  const range = parsePeriod(period)
  const baseOutwardWhere = savedDocWhere(businessId, range, ['SALE_INVOICE'])

  const [
    outwardNonRcm,     // Table 3.1(a) — Outward taxable supplies (other than RCM)
    outwardRcm,        // Table 3.1(b) — Outward taxable supplies (subject to RCM, supplier collects)
    inward,
    creditNotes,
  ] = await Promise.all([
    prisma.document.aggregate({
      where: { ...baseOutwardWhere, isReverseCharge: false },
      _sum: { totalTaxableValue: true, totalCgst: true, totalSgst: true, totalIgst: true, totalCess: true },
      _count: true,
    }),
    prisma.document.aggregate({
      where: { ...baseOutwardWhere, isReverseCharge: true },
      _sum: { totalTaxableValue: true, totalCgst: true, totalSgst: true, totalIgst: true, totalCess: true },
      _count: true,
    }),
    prisma.document.aggregate({
      where: savedDocWhere(businessId, range, ['PURCHASE_INVOICE']),
      _sum: { totalTaxableValue: true, totalCgst: true, totalSgst: true, totalIgst: true, totalCess: true },
      _count: true,
    }),
    prisma.document.aggregate({
      where: savedDocWhere(businessId, range, ['CREDIT_NOTE']),
      _sum: { totalTaxableValue: true, totalCgst: true, totalSgst: true, totalIgst: true, totalCess: true },
      _count: true,
    }),
  ])

  type AggResult = typeof outwardNonRcm
  const s = (agg: AggResult, field: string) => (agg._sum as Record<string, number | null>)[field] ?? 0

  // Table 3.1(a) — Outward taxable supplies (other than RCM and composition)
  const table3_1a = {
    taxable: s(outwardNonRcm, 'totalTaxableValue'),
    cgst: s(outwardNonRcm, 'totalCgst'),
    sgst: s(outwardNonRcm, 'totalSgst'),
    igst: s(outwardNonRcm, 'totalIgst'),
    cess: s(outwardNonRcm, 'totalCess'),
    invoiceCount: outwardNonRcm._count,
  }

  // Table 3.1(b) — Outward taxable supplies subject to reverse charge
  const table3_1b = {
    taxable: s(outwardRcm, 'totalTaxableValue'),
    cgst: s(outwardRcm, 'totalCgst'),
    sgst: s(outwardRcm, 'totalSgst'),
    igst: s(outwardRcm, 'totalIgst'),
    cess: s(outwardRcm, 'totalCess'),
    invoiceCount: outwardRcm._count,
  }

  // Combined outward total (for backward compat)
  const table3_1 = {
    taxableOutward: table3_1a.taxable + table3_1b.taxable,
    cgst: table3_1a.cgst + table3_1b.cgst,
    sgst: table3_1a.sgst + table3_1b.sgst,
    igst: table3_1a.igst + table3_1b.igst,
    cess: table3_1a.cess + table3_1b.cess,
    invoiceCount: outwardNonRcm._count + outwardRcm._count,
  }

  // Table 4 — ITC available (from purchases)
  const table4 = {
    taxableInward: s(inward, 'totalTaxableValue'),
    cgst: s(inward, 'totalCgst'),
    sgst: s(inward, 'totalSgst'),
    igst: s(inward, 'totalIgst'),
    cess: s(inward, 'totalCess'),
    invoiceCount: inward._count,
  }

  // Net tax payable
  const cnCgst = s(creditNotes, 'totalCgst')
  const cnSgst = s(creditNotes, 'totalSgst')
  const cnIgst = s(creditNotes, 'totalIgst')
  const cnCess = s(creditNotes, 'totalCess')

  const netPayable = {
    cgst: Math.max(0, table3_1.cgst - table4.cgst - cnCgst),
    sgst: Math.max(0, table3_1.sgst - table4.sgst - cnSgst),
    igst: Math.max(0, table3_1.igst - table4.igst - cnIgst),
    cess: Math.max(0, table3_1.cess - table4.cess - cnCess),
  }

  return {
    period,
    // Table 3.1 split (RCM vs non-RCM)
    outwardSuppliesNonRcm: table3_1a,
    outwardSuppliesRcm: table3_1b,
    // Combined totals (backward compatible)
    outwardSupplies: table3_1,
    inputTaxCredit: table4,
    creditNoteAdjustment: {
      taxable: s(creditNotes, 'totalTaxableValue'),
      cgst: cnCgst,
      sgst: cnSgst,
      igst: cnIgst,
      cess: cnCess,
      count: creditNotes._count,
    },
    netTaxPayable: netPayable,
    totalPayable: netPayable.cgst + netPayable.sgst + netPayable.igst + netPayable.cess,
  }
}
