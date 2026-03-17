/**
 * GST Return Service — GSTR-1, GSTR-3B, GSTR-9 generation and export
 * All amounts in PAISE. Generates summary + JSON in government format.
 */

import { prisma } from '../lib/prisma.js'

interface PeriodRange { gte: Date; lte: Date }

function parsePeriod(period: string): PeriodRange {
  const [year, month] = period.split('-').map(Number)
  const gte = new Date(year, month - 1, 1)
  const lte = new Date(year, month, 0, 23, 59, 59, 999)
  return { gte, lte }
}

function parseFinancialYear(period: string): PeriodRange {
  const [year, month] = period.split('-').map(Number)
  // FY starts April of the year, ends March next year
  const fyStart = month >= 4 ? year : year - 1
  return { gte: new Date(fyStart, 3, 1), lte: new Date(fyStart + 1, 2, 31, 23, 59, 59, 999) }
}

const savedDocWhere = (businessId: string, range: PeriodRange, types: string[]) => ({
  businessId,
  status: 'SAVED',
  type: { in: types },
  documentDate: range,
  deletedAt: null,
})

// ─── GSTR-1 — Outward Supplies ─────────────────────────────────────────────

export async function generateGstr1(businessId: string, period: string) {
  const range = parsePeriod(period)
  const baseWhere = savedDocWhere(businessId, range, ['SALE_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE'])

  // Fetch all saved sale invoices + credit/debit notes with party + line items
  const docs = await prisma.document.findMany({
    where: baseWhere,
    select: {
      id: true, type: true, documentNumber: true, documentDate: true,
      supplyType: true, placeOfSupply: true, isReverseCharge: true,
      totalTaxableValue: true, totalCgst: true, totalSgst: true, totalIgst: true, totalCess: true, grandTotal: true,
      party: { select: { id: true, name: true, gstin: true, stateCode: true } },
      lineItems: {
        select: {
          hsnCode: true, taxableValue: true,
          cgstRate: true, cgstAmount: true, sgstRate: true, sgstAmount: true,
          igstRate: true, igstAmount: true, cessRate: true, cessAmount: true,
          lineTotal: true, quantity: true,
        },
      },
    },
    orderBy: { documentDate: 'asc' },
  })

  // Categorize by GSTR-1 tables
  const b2b: typeof docs = []        // B2B invoices (with party GSTIN)
  const b2cl: typeof docs = []       // B2C Large (inter-state > Rs 2.5 lakh)
  const b2cs: typeof docs = []       // B2C Small (aggregated by state)
  const cdnr: typeof docs = []       // Credit/Debit notes to registered
  const cdnur: typeof docs = []      // Credit/Debit notes to unregistered

  for (const doc of docs) {
    const isNote = doc.type === 'CREDIT_NOTE' || doc.type === 'DEBIT_NOTE'
    const hasGstin = !!doc.party.gstin

    if (isNote) {
      ;(hasGstin ? cdnr : cdnur).push(doc)
    } else if (hasGstin) {
      b2b.push(doc)
    } else if (doc.grandTotal > 250000 && doc.placeOfSupply !== doc.party.stateCode) {
      b2cl.push(doc)
    } else {
      b2cs.push(doc)
    }
  }

  // HSN summary (aggregated across all docs)
  const hsnMap = new Map<string, { qty: number; taxable: number; cgst: number; sgst: number; igst: number; cess: number }>()
  for (const doc of docs) {
    if (doc.type !== 'SALE_INVOICE') continue
    for (const li of doc.lineItems) {
      const code = li.hsnCode ?? 'UNKNOWN'
      const existing = hsnMap.get(code) ?? { qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 }
      existing.qty += li.quantity
      existing.taxable += li.taxableValue
      existing.cgst += li.cgstAmount
      existing.sgst += li.sgstAmount
      existing.igst += li.igstAmount
      existing.cess += li.cessAmount
      hsnMap.set(code, existing)
    }
  }

  const summary = {
    period,
    totalInvoices: docs.filter((d) => d.type === 'SALE_INVOICE').length,
    totalCreditNotes: docs.filter((d) => d.type === 'CREDIT_NOTE').length,
    totalDebitNotes: docs.filter((d) => d.type === 'DEBIT_NOTE').length,
    b2b: { count: b2b.length, taxable: sumField(b2b, 'totalTaxableValue'), tax: sumTax(b2b) },
    b2cl: { count: b2cl.length, taxable: sumField(b2cl, 'totalTaxableValue'), tax: sumTax(b2cl) },
    b2cs: { count: b2cs.length, taxable: sumField(b2cs, 'totalTaxableValue'), tax: sumTax(b2cs) },
    cdnr: { count: cdnr.length, taxable: sumField(cdnr, 'totalTaxableValue'), tax: sumTax(cdnr) },
    cdnur: { count: cdnur.length, taxable: sumField(cdnur, 'totalTaxableValue'), tax: sumTax(cdnur) },
  }

  return { summary, b2b, b2cl, b2cs, cdnr, cdnur, hsn: Array.from(hsnMap.entries()).map(([code, v]) => ({ hsnCode: code, ...v })) }
}

// ─── GSTR-3B — Monthly Summary Return ───────────────────────────────────────

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

// ─── GSTR-9 — Annual Return Summary ─────────────────────────────────────────

export async function generateGstr9(businessId: string, period: string) {
  const range = parseFinancialYear(period)

  const types = ['SALE_INVOICE', 'PURCHASE_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE']
  const docs = await prisma.document.groupBy({
    by: ['type'],
    where: savedDocWhere(businessId, range, types),
    _sum: { totalTaxableValue: true, totalCgst: true, totalSgst: true, totalIgst: true, totalCess: true, grandTotal: true },
    _count: true,
  })

  const byType = (t: string) => {
    const d = docs.find((r) => r.type === t)
    return {
      count: d?._count ?? 0,
      taxable: d?._sum.totalTaxableValue ?? 0,
      cgst: d?._sum.totalCgst ?? 0,
      sgst: d?._sum.totalSgst ?? 0,
      igst: d?._sum.totalIgst ?? 0,
      cess: d?._sum.totalCess ?? 0,
      total: d?._sum.grandTotal ?? 0,
    }
  }

  return {
    financialYear: `${range.gte.getFullYear()}-${range.lte.getFullYear()}`,
    sales: byType('SALE_INVOICE'),
    purchases: byType('PURCHASE_INVOICE'),
    creditNotes: byType('CREDIT_NOTE'),
    debitNotes: byType('DEBIT_NOTE'),
  }
}

// ─── GSTR-1 JSON Export (Government format stub) ────────────────────────────

export async function exportGstr1Json(businessId: string, period: string) {
  const data = await generateGstr1(businessId, period)

  // Government GSTR-1 JSON structure (simplified — real format has more fields)
  const json = {
    gstin: '', // filled by caller from business settings
    fp: period.replace('-', ''), // MMYYYY format
    b2b: data.b2b.map((d) => ({
      ctin: d.party.gstin,
      inv: [{
        inum: d.documentNumber,
        idt: formatDateDDMMYYYY(d.documentDate),
        val: d.grandTotal / 100,
        pos: d.placeOfSupply,
        rchrg: d.isReverseCharge ? 'Y' : 'N',
        itms: d.lineItems.map((li) => ({
          num: 0,
          itm_det: {
            txval: li.taxableValue / 100,
            camt: li.cgstAmount / 100,
            samt: li.sgstAmount / 100,
            iamt: li.igstAmount / 100,
            csamt: li.cessAmount / 100,
          },
        })),
      }],
    })),
    b2cl: data.b2cl.map((d) => ({
      pos: d.placeOfSupply,
      inv: [{
        inum: d.documentNumber,
        idt: formatDateDDMMYYYY(d.documentDate),
        val: d.grandTotal / 100,
        itms: d.lineItems.map((li) => ({
          num: 0,
          itm_det: { txval: li.taxableValue / 100, iamt: li.igstAmount / 100, csamt: li.cessAmount / 100 },
        })),
      }],
    })),
    hsn: {
      data: data.hsn.map((h) => ({
        hsn_sc: h.hsnCode,
        qty: h.qty,
        txval: h.taxable / 100,
        camt: h.cgst / 100,
        samt: h.sgst / 100,
        iamt: h.igst / 100,
        csamt: h.cess / 100,
      })),
    },
  }

  return {
    json,
    fileName: `GSTR1_${period}.json`,
    summary: data.summary,
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sumField(docs: Array<{ totalTaxableValue: number }>, field: 'totalTaxableValue') {
  return docs.reduce((sum, d) => sum + d[field], 0)
}

function sumTax(docs: Array<{ totalCgst: number; totalSgst: number; totalIgst: number; totalCess: number }>) {
  return docs.reduce((sum, d) => sum + d.totalCgst + d.totalSgst + d.totalIgst + d.totalCess, 0)
}

function formatDateDDMMYYYY(date: Date): string {
  const d = new Date(date)
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}
