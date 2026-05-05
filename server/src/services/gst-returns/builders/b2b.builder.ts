/**
 * B2B Builder — NIC GSTR-1 table 4A/4B.
 * Covers SALE_INVOICE and DEBIT_NOTE where party has a GSTIN (supplyType = B2B).
 * All amounts in PAISE. Conversion to rupees happens at the export boundary only.
 */

import type { ExtendedPrismaClient } from '../../../lib/prisma.js'
import { parsePeriod } from '../period.utils.js'

export interface NicItmDet {
  txval: number  // taxable value (paise)
  rt: number     // GST rate (e.g. 18 for 18%)
  camt: number   // CGST (paise)
  samt: number   // SGST (paise)
  iamt: number   // IGST (paise)
  csamt: number  // Cess (paise)
}

export interface NicB2BInv {
  inum: string
  idt: string    // DD-MM-YYYY
  val: number    // grand total (paise)
  pos: string    // place of supply (2-digit state code)
  rchrg: 'Y' | 'N'
  etin?: string  // e-invoice IRN or omit
  inv_typ: 'R' | 'DE' | 'SEWP' | 'SEWOP' | 'CBW'  // regular, deemed export, etc.
  itms: Array<{ num: number; itm_det: NicItmDet }>
}

export interface NicB2BEntry {
  ctin: string   // customer GSTIN
  inv: NicB2BInv[]
}

function fmtDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${d.getUTCFullYear()}`
}

export async function buildB2b(
  prisma: ExtendedPrismaClient,
  businessId: string,
  period: string,
): Promise<NicB2BEntry[]> {
  const [start, end] = parsePeriod(period)

  const docs = await prisma.document.findMany({
    where: {
      businessId,
      supplyType: 'B2B',
      type: { in: ['SALE_INVOICE', 'DEBIT_NOTE'] },
      documentDate: { gte: start, lt: end },
      status: 'SAVED',
      deletedAt: null,
    },
    select: {
      documentNumber: true,
      documentDate: true,
      grandTotal: true,
      placeOfSupply: true,
      isReverseCharge: true,
      party: { select: { gstin: true } },
      lineItems: {
        select: {
          taxableValue: true,
          cgstRate: true, cgstAmount: true,
          sgstRate: true, sgstAmount: true,
          igstRate: true, igstAmount: true,
          cessAmount: true,
        },
      },
    },
    orderBy: { documentDate: 'asc' },
  })

  // Group invoices by party GSTIN
  const map = new Map<string, NicB2BInv[]>()
  for (const doc of docs) {
    const ctin = doc.party?.gstin ?? ''
    if (!ctin) continue
    const rate = (doc.lineItems[0]?.cgstRate ?? 0) + (doc.lineItems[0]?.sgstRate ?? 0) + (doc.lineItems[0]?.igstRate ?? 0)
    const inv: NicB2BInv = {
      inum: doc.documentNumber ?? '',
      idt: fmtDate(doc.documentDate),
      val: doc.grandTotal,
      pos: doc.placeOfSupply ?? '',
      rchrg: doc.isReverseCharge ? 'Y' : 'N',
      inv_typ: 'R',
      itms: doc.lineItems.map((li: typeof doc.lineItems[0], idx: number) => ({
        num: idx + 1,
        itm_det: {
          txval: li.taxableValue, rt: rate,
          camt: li.cgstAmount, samt: li.sgstAmount,
          iamt: li.igstAmount, csamt: li.cessAmount,
        },
      })),
    }
    const list = map.get(ctin) ?? []
    list.push(inv)
    map.set(ctin, list)
  }

  return Array.from(map.entries()).map(([ctin, inv]) => ({ ctin, inv }))
}
