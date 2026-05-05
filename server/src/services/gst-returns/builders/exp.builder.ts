/**
 * EXP Builder — NIC GSTR-1 table 6A (Export invoices).
 * Flag-only in v7: returns invoice metadata, not line-level detail.
 * All amounts in PAISE.
 */

import type { ExtendedPrismaClient } from '../../../lib/prisma.js'
import { parsePeriod } from '../period.utils.js'

export interface NicExpInv {
  inum: string
  idt: string   // DD-MM-YYYY
  val: number   // grand total (paise)
  sbpcode?: string
  sbnum?: string
  sbdt?: string
}

export interface NicExpEntry {
  exp_typ: 'WPAY' | 'WOPAY'  // with payment / without payment of IGST
  inv: NicExpInv[]
}

function fmtDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${d.getUTCFullYear()}`
}

export async function buildExp(
  prisma: ExtendedPrismaClient,
  businessId: string,
  period: string,
): Promise<NicExpEntry[]> {
  const [start, end] = parsePeriod(period)

  const docs = await prisma.document.findMany({
    where: {
      businessId,
      supplyType: 'EXPORT',
      type: 'SALE_INVOICE',
      documentDate: { gte: start, lt: end },
      status: 'SAVED',
      deletedAt: null,
    },
    select: {
      documentNumber: true,
      documentDate: true,
      grandTotal: true,
      totalIgst: true,
    },
    orderBy: { documentDate: 'asc' },
  })

  if (docs.length === 0) return []

  // Group by exp_typ: WPAY if IGST > 0, else WOPAY
  const wpay: NicExpInv[] = []
  const wopay: NicExpInv[] = []

  for (const doc of docs) {
    const inv: NicExpInv = {
      inum: doc.documentNumber ?? '',
      idt: fmtDate(doc.documentDate),
      val: doc.grandTotal,
    }
    if (doc.totalIgst > 0) wpay.push(inv)
    else wopay.push(inv)
  }

  const result: NicExpEntry[] = []
  if (wpay.length)  result.push({ exp_typ: 'WPAY',  inv: wpay })
  if (wopay.length) result.push({ exp_typ: 'WOPAY', inv: wopay })
  return result
}
