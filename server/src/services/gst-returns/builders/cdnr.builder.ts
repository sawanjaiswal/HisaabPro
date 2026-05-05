/**
 * CDNR Builder — NIC GSTR-1 table 9B.
 * Credit/Debit notes issued to registered parties (B2B).
 * All amounts in PAISE.
 */

import type { ExtendedPrismaClient } from '../../../lib/prisma.js'
import { parsePeriod } from '../period.utils.js'

export interface NicCdnrNt {
  ntty: 'C' | 'D'  // C = Credit Note, D = Debit Note
  nt_num: string
  nt_dt: string     // DD-MM-YYYY
  val: number       // grand total (paise)
  rchrg: 'Y' | 'N'
  itms: Array<{ num: number; itm_det: { txval: number; rt: number; camt: number; samt: number; iamt: number; csamt: number } }>
}

export interface NicCdnrEntry {
  ctin: string
  nt: NicCdnrNt[]
}

function fmtDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${d.getUTCFullYear()}`
}

export async function buildCdnr(
  prisma: ExtendedPrismaClient,
  businessId: string,
  period: string,
): Promise<NicCdnrEntry[]> {
  const [start, end] = parsePeriod(period)

  const docs = await prisma.document.findMany({
    where: {
      businessId,
      type: { in: ['CREDIT_NOTE', 'DEBIT_NOTE'] },
      documentDate: { gte: start, lt: end },
      status: 'SAVED',
      deletedAt: null,
      party: { gstin: { not: null } },
    },
    select: {
      type: true,
      documentNumber: true,
      documentDate: true,
      grandTotal: true,
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

  const map = new Map<string, NicCdnrNt[]>()
  for (const doc of docs) {
    const ctin = doc.party?.gstin ?? ''
    if (!ctin) continue
    const rate = (doc.lineItems[0]?.cgstRate ?? 0) + (doc.lineItems[0]?.sgstRate ?? 0) + (doc.lineItems[0]?.igstRate ?? 0)
    const nt: NicCdnrNt = {
      ntty: doc.type === 'CREDIT_NOTE' ? 'C' : 'D',
      nt_num: doc.documentNumber ?? '',
      nt_dt: fmtDate(doc.documentDate),
      val: doc.grandTotal,
      rchrg: doc.isReverseCharge ? 'Y' : 'N',
      itms: doc.lineItems.map((li: typeof doc.lineItems[0], idx: number) => ({
        num: idx + 1,
        itm_det: { txval: li.taxableValue, rt: rate, camt: li.cgstAmount, samt: li.sgstAmount, iamt: li.igstAmount, csamt: li.cessAmount },
      })),
    }
    const list = map.get(ctin) ?? []
    list.push(nt)
    map.set(ctin, list)
  }

  return Array.from(map.entries()).map(([ctin, nt]) => ({ ctin, nt }))
}
