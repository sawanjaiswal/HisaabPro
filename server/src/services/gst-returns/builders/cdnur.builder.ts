/**
 * CDNUR Builder — NIC GSTR-1 table 9B (unregistered).
 * Credit/Debit notes to B2C Large / Export parties (no GSTIN).
 * All amounts in PAISE.
 */

import type { ExtendedPrismaClient } from '../../../lib/prisma.js'
import { parsePeriod } from '../period.utils.js'

export interface NicCdnurEntry {
  typ: 'B2CL' | 'EXPWP' | 'EXPWOP'
  ntty: 'C' | 'D'
  nt_num: string
  nt_dt: string     // DD-MM-YYYY
  val: number       // grand total (paise)
  pos?: string
  itms: Array<{ num: number; itm_det: { txval: number; rt: number; iamt: number; csamt: number } }>
}

function fmtDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${d.getUTCFullYear()}`
}

export async function buildCdnur(
  prisma: ExtendedPrismaClient,
  businessId: string,
  period: string,
): Promise<NicCdnurEntry[]> {
  const [start, end] = parsePeriod(period)

  const docs = await prisma.document.findMany({
    where: {
      businessId,
      type: { in: ['CREDIT_NOTE', 'DEBIT_NOTE'] },
      documentDate: { gte: start, lt: end },
      status: 'SAVED',
      deletedAt: null,
      party: { gstin: null },
    },
    select: {
      type: true,
      documentNumber: true,
      documentDate: true,
      grandTotal: true,
      placeOfSupply: true,
      supplyType: true,
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

  type DocItem = typeof docs[0]
  return docs.map((doc: DocItem) => {
    const rate = doc.lineItems[0]?.igstRate ?? 0
    const typ: NicCdnurEntry['typ'] =
      doc.supplyType === 'EXPORT' ? 'EXPWP' : 'B2CL'

    return {
      typ,
      ntty: doc.type === 'CREDIT_NOTE' ? 'C' : 'D',
      nt_num: doc.documentNumber ?? '',
      nt_dt: fmtDate(doc.documentDate),
      val: doc.grandTotal,
      pos: doc.placeOfSupply ?? undefined,
      itms: doc.lineItems.map((li: typeof doc.lineItems[0], idx: number) => ({
        num: idx + 1,
        itm_det: { txval: li.taxableValue, rt: rate, iamt: li.igstAmount, csamt: li.cessAmount },
      })),
    }
  })
}
