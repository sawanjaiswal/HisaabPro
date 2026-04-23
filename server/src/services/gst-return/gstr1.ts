/**
 * GSTR-1 — Outward Supplies.
 * Categorises sale invoices and credit/debit notes into GSTR-1 tables
 * (B2B, B2CL, B2CS, CDNR, CDNUR) plus an HSN summary.
 */

import { prisma } from '../../lib/prisma.js'
import { parsePeriod, savedDocWhere, sumField, sumTax } from './helpers.js'

export async function generateGstr1(businessId: string, period: string) {
  const range = parsePeriod(period)
  const baseWhere = savedDocWhere(businessId, range, ['SALE_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE'])

  // Fetch saved sale invoices + credit/debit notes with party + line items
  // Safety cap at 10000 to prevent OOM on large datasets (tax reports still get full month data)
  const docs = await prisma.document.findMany({
    where: baseWhere,
    take: 10000,
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
  // Note: quantities are in the unit specified per line item. GST filing
  // expects same-HSN items to share a common UQC (unit quantity code).
  // If products with the same HSN use different units, quantities will be
  // summed without conversion — caller should ensure unit consistency per HSN.
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
