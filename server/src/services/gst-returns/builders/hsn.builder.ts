/**
 * HSN Builder — NIC GSTR-1 table 12.
 * Aggregated by (hsnCode, gstRate, uqc).
 * One row per (hsn, rate, unit) triple. SUM qty + amounts.
 * All amounts in PAISE.
 */

import type { ExtendedPrismaClient } from '../../../lib/prisma.js'
import { parsePeriod } from '../period.utils.js'

export interface NicHsnEntry {
  hsn_sc: string
  uqc: string     // Unit Quantity Code per NIC (NOS, KGS, MTR, etc.)
  rt: number      // GST rate (basis points, e.g. 1800)
  qty: number
  txval: number   // taxable value (paise)
  camt: number    // CGST (paise)
  samt: number    // SGST (paise)
  iamt: number    // IGST (paise)
  csamt: number   // Cess (paise)
}

export async function buildHsn(
  prisma: ExtendedPrismaClient,
  businessId: string,
  period: string,
): Promise<NicHsnEntry[]> {
  const [start, end] = parsePeriod(period)

  const lineItems = await prisma.documentLineItem.findMany({
    where: {
      document: {
        businessId,
        type: { in: ['SALE_INVOICE', 'DEBIT_NOTE'] },
        documentDate: { gte: start, lt: end },
        status: 'SAVED',
        deletedAt: null,
      },
    },
    select: {
      hsnCode: true,
      quantity: true,
      taxableValue: true,
      cgstRate: true, cgstAmount: true,
      sgstRate: true, sgstAmount: true,
      igstRate: true, igstAmount: true,
      cessAmount: true,
    },
  })

  // Collect distinct HSN codes to fetch UQC in one query
  const hsnCodes = [...new Set(lineItems.map((li) => li.hsnCode).filter((c): c is string => c !== null && c !== undefined))]

  const hsnRecords: Array<{ code: string; uqc: string }> = hsnCodes.length
    ? await prisma.hsnCode.findMany({
        where: { code: { in: hsnCodes } },
        select: { code: true, uqc: true },
      })
    : []

  const uqcMap = new Map<string, string>(hsnRecords.map((h) => [h.code, h.uqc]))

  const agg = new Map<string, NicHsnEntry>()

  for (const li of lineItems) {
    const hsnSc = li.hsnCode ?? ''
    const uqc = uqcMap.get(hsnSc) ?? 'NOS'
    const rt = li.cgstRate + li.sgstRate + li.igstRate
    const key = `${hsnSc}::${rt}::${uqc}`

    const existing = agg.get(key)
    if (existing) {
      existing.qty   += li.quantity
      existing.txval += li.taxableValue
      existing.camt  += li.cgstAmount
      existing.samt  += li.sgstAmount
      existing.iamt  += li.igstAmount
      existing.csamt += li.cessAmount
    } else {
      agg.set(key, {
        hsn_sc: hsnSc,
        uqc,
        rt,
        qty: li.quantity,
        txval: li.taxableValue,
        camt: li.cgstAmount,
        samt: li.sgstAmount,
        iamt: li.igstAmount,
        csamt: li.cessAmount,
      })
    }
  }

  return Array.from(agg.values())
}
