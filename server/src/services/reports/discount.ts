/**
 * Discount Report — Discount analysis by document and party
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { REPORT_ROW_LIMIT } from './helpers.js'

export async function getDiscountReport(businessId: string, from: Date, to: Date) {
  const docs = await prisma.document.findMany({
    where: {
      businessId,
      type: 'SALE_INVOICE',
      status: { not: 'DELETED' },
      documentDate: { gte: from, lte: to },
      totalDiscount: { gt: 0 },
    },
    select: {
      id: true,
      documentNumber: true,
      subtotal: true,
      totalDiscount: true,
      partyId: true,
      party: { select: { id: true, name: true } },
    },
    take: REPORT_ROW_LIMIT,
  })

  if (docs.length === REPORT_ROW_LIMIT) {
    logger.warn('getDiscountReport: result set capped at limit', { businessId, limit: REPORT_ROW_LIMIT })
  }

  const totalDiscount = docs.reduce((s, d) => s + d.totalDiscount, 0)

  const byDocument = docs.map((d) => ({
    documentNumber: d.documentNumber ?? d.id,
    partyName: d.party.name,
    subtotal: d.subtotal,
    discount: d.totalDiscount,
    discountPercent: d.subtotal > 0 ? (d.totalDiscount / d.subtotal) * 100 : 0,
  }))

  // Group by party
  const partyMap = new Map<
    string,
    { partyName: string; totalDiscount: number; invoiceCount: number }
  >()

  for (const d of docs) {
    const existing = partyMap.get(d.partyId)
    if (existing) {
      existing.totalDiscount += d.totalDiscount
      existing.invoiceCount += 1
    } else {
      partyMap.set(d.partyId, {
        partyName: d.party.name,
        totalDiscount: d.totalDiscount,
        invoiceCount: 1,
      })
    }
  }

  const byParty = Array.from(partyMap.values()).sort((a, b) => b.totalDiscount - a.totalDiscount)

  return {
    period: { from, to },
    totalDiscount,
    byDocument,
    byParty,
  }
}
