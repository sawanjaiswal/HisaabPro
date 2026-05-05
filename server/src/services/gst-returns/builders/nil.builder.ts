/**
 * NIL Builder — NIC GSTR-1 table 8.
 * Nil-rated, exempt, and non-GST outward supplies.
 * All amounts in PAISE.
 */

import type { ExtendedPrismaClient } from '../../../lib/prisma.js'
import { parsePeriod } from '../period.utils.js'

export interface NicNilInv {
  sply_ty: 'INTRB2B' | 'INTRB2C' | 'INTRAB2B' | 'INTRAB2C'
  nil_amt: number   // nil-rated amount (paise)
  expt_amt: number  // exempt amount (paise)
  ngsup_amt: number // non-GST amount (paise)
}

export async function buildNil(
  prisma: ExtendedPrismaClient,
  businessId: string,
  period: string,
): Promise<NicNilInv[]> {
  const [start, end] = parsePeriod(period)

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { stateCode: true },
  })
  const bizState = business?.stateCode ?? ''

  const docs = await prisma.document.findMany({
    where: {
      businessId,
      type: { in: ['SALE_INVOICE', 'DEBIT_NOTE'] },
      documentDate: { gte: start, lt: end },
      status: 'SAVED',
      deletedAt: null,
      // Nil-rated: totalCgst + totalSgst + totalIgst = 0 but has taxable value
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      totalTaxableValue: { gt: 0 },
    },
    select: {
      placeOfSupply: true,
      totalTaxableValue: true,
      party: { select: { gstin: true } },
    },
  })

  const acc: Record<string, NicNilInv> = {}

  for (const doc of docs) {
    const hasGstin = !!doc.party?.gstin
    const pos = doc.placeOfSupply ?? ''
    const interState = bizState !== pos && pos !== ''

    let splyTy: NicNilInv['sply_ty']
    if (interState && hasGstin)        splyTy = 'INTRB2B'
    else if (interState && !hasGstin)  splyTy = 'INTRB2C'
    else if (!interState && hasGstin)  splyTy = 'INTRAB2B'
    else                               splyTy = 'INTRAB2C'

    if (!acc[splyTy]) {
      acc[splyTy] = { sply_ty: splyTy, nil_amt: 0, expt_amt: 0, ngsup_amt: 0 }
    }
    acc[splyTy].nil_amt += doc.totalTaxableValue
  }

  return Object.values(acc)
}
