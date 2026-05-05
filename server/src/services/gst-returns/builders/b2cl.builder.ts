/**
 * B2CL Builder — NIC GSTR-1 table 5.
 * B2C Large: inter-state invoices > Rs 2.5 lakh (grandTotal > 250000 paise × 100 = 25000000).
 * All amounts in PAISE.
 */

import type { ExtendedPrismaClient } from '../../../lib/prisma.js'
import { parsePeriod } from '../period.utils.js'

export interface NicB2CLItmDet {
  txval: number
  rt: number
  iamt: number
  csamt: number
}

export interface NicB2CLInv {
  inum: string
  idt: string
  val: number   // grand total (paise)
  itms: Array<{ num: number; itm_det: NicB2CLItmDet }>
}

export interface NicB2CLEntry {
  pos: string   // place of supply state code
  inv: NicB2CLInv[]
}

function fmtDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${d.getUTCFullYear()}`
}

export async function buildB2cl(
  prisma: ExtendedPrismaClient,
  businessId: string,
  period: string,
): Promise<NicB2CLEntry[]> {
  const [start, end] = parsePeriod(period)

  const docs = await prisma.document.findMany({
    where: {
      businessId,
      supplyType: 'B2C_LARGE',
      type: 'SALE_INVOICE',
      documentDate: { gte: start, lt: end },
      status: 'SAVED',
      deletedAt: null,
    },
    select: {
      documentNumber: true,
      documentDate: true,
      grandTotal: true,
      placeOfSupply: true,
      lineItems: {
        select: {
          taxableValue: true,
          igstRate: true, igstAmount: true,
          cgstRate: true, sgstRate: true,
          cessAmount: true,
        },
      },
    },
    orderBy: { documentDate: 'asc' },
  })

  const map = new Map<string, NicB2CLInv[]>()
  for (const doc of docs) {
    const pos = doc.placeOfSupply ?? ''
    const rate = (doc.lineItems[0]?.igstRate ?? 0)
    const inv: NicB2CLInv = {
      inum: doc.documentNumber ?? '',
      idt: fmtDate(doc.documentDate),
      val: doc.grandTotal,
      itms: doc.lineItems.map((li: typeof doc.lineItems[0], idx: number) => ({
        num: idx + 1,
        itm_det: { txval: li.taxableValue, rt: rate, iamt: li.igstAmount, csamt: li.cessAmount },
      })),
    }
    const list = map.get(pos) ?? []
    list.push(inv)
    map.set(pos, list)
  }

  return Array.from(map.entries()).map(([pos, inv]) => ({ pos, inv }))
}
