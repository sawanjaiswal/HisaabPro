/**
 * B2CS Builder — NIC GSTR-1 table 7.
 * B2C Small: aggregated by (placeOfSupply, gstRate).
 * One row per state-rate pair (not one per invoice).
 * All amounts in PAISE.
 */

import type { ExtendedPrismaClient } from '../../../lib/prisma.js'
import { parsePeriod } from '../period.utils.js'

export interface NicB2CSEntry {
  sply_ty: 'INTRA' | 'INTER'
  pos: string
  typ: 'OE'  // OE = Other than E-commerce
  rt: number
  txval: number
  iamt: number
  camt: number
  samt: number
  csamt: number
}

interface AggVal {
  sply_ty: 'INTRA' | 'INTER'
  pos: string
  rt: number
  txval: number
  iamt: number
  camt: number
  samt: number
  csamt: number
}

export async function buildB2cs(
  prisma: ExtendedPrismaClient,
  businessId: string,
  period: string,
): Promise<NicB2CSEntry[]> {
  const [start, end] = parsePeriod(period)

  // Get business stateCode for intra/inter determination
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { stateCode: true },
  })
  const bizState = business?.stateCode ?? ''

  const docs = await prisma.document.findMany({
    where: {
      businessId,
      supplyType: 'B2C_SMALL',
      type: 'SALE_INVOICE',
      documentDate: { gte: start, lt: end },
      status: 'SAVED',
      deletedAt: null,
    },
    select: {
      placeOfSupply: true,
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
  })

  const agg = new Map<string, AggVal>()

  for (const doc of docs) {
    const pos = doc.placeOfSupply ?? ''
    const interState = bizState !== pos && pos !== ''

    for (const li of doc.lineItems) {
      const rt = li.cgstRate + li.sgstRate + li.igstRate
      const mapKey = `${pos}::${rt}`

      const existing = agg.get(mapKey)
      if (existing) {
        existing.txval  += li.taxableValue
        existing.iamt   += li.igstAmount
        existing.camt   += li.cgstAmount
        existing.samt   += li.sgstAmount
        existing.csamt  += li.cessAmount
      } else {
        agg.set(mapKey, {
          sply_ty: interState ? 'INTER' : 'INTRA',
          pos,
          rt,
          txval: li.taxableValue,
          iamt: li.igstAmount,
          camt: li.cgstAmount,
          samt: li.sgstAmount,
          csamt: li.cessAmount,
        })
      }
    }
  }

  return Array.from(agg.values()).map((v) => ({ ...v, typ: 'OE' as const }))
}
