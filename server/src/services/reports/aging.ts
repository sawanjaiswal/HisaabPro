/**
 * Aging Report — Receivable / Payable aging buckets by party
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { REPORT_ROW_LIMIT } from './helpers.js'

export async function getAgingReport(
  businessId: string,
  type: 'RECEIVABLE' | 'PAYABLE',
  asOf?: Date,
) {
  const referenceDate = asOf ?? new Date()

  const docType = type === 'RECEIVABLE' ? 'SALE_INVOICE' : 'PURCHASE_INVOICE'

  const docs = await prisma.document.findMany({
    where: {
      businessId,
      type: docType,
      status: { not: 'DELETED' },
      balanceDue: { gt: 0 },
      documentDate: { lte: referenceDate },
    },
    select: {
      id: true,
      partyId: true,
      balanceDue: true,
      documentDate: true,
      dueDate: true,
      party: { select: { id: true, name: true } },
    },
    take: REPORT_ROW_LIMIT,
  })

  if (docs.length === REPORT_ROW_LIMIT) {
    logger.warn('getAgingReport: result set capped at limit', { businessId, type, limit: REPORT_ROW_LIMIT })
  }

  type AgingBuckets = {
    current: number
    days1to30: number
    days31to60: number
    days61to90: number
    days91to120: number
    over120: number
    total: number
  }

  const partyMap = new Map<
    string,
    { partyId: string; partyName: string } & AgingBuckets
  >()

  const summary: AgingBuckets = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days91to120: 0,
    over120: 0,
    total: 0,
  }

  const msPerDay = 24 * 60 * 60 * 1000

  for (const doc of docs) {
    const dueAt = doc.dueDate ?? doc.documentDate
    const ageMs = referenceDate.getTime() - dueAt.getTime()
    const ageDays = Math.floor(ageMs / msPerDay)
    const amount = doc.balanceDue

    let bucket: keyof AgingBuckets = 'current'
    if (ageDays <= 0) bucket = 'current'
    else if (ageDays <= 30) bucket = 'days1to30'
    else if (ageDays <= 60) bucket = 'days31to60'
    else if (ageDays <= 90) bucket = 'days61to90'
    else if (ageDays <= 120) bucket = 'days91to120'
    else bucket = 'over120'

    // Update summary
    summary[bucket] += amount
    summary.total += amount

    // Update per-party
    const existing = partyMap.get(doc.partyId)
    if (existing) {
      existing[bucket] += amount
      existing.total += amount
    } else {
      partyMap.set(doc.partyId, {
        partyId: doc.partyId,
        partyName: doc.party.name,
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days91to120: 0,
        over120: 0,
        total: 0,
        [bucket]: amount,
      })
      partyMap.get(doc.partyId)!.total = amount
    }
  }

  return {
    type,
    asOf: referenceDate,
    summary,
    parties: Array.from(partyMap.values()).sort((a, b) => b.total - a.total),
  }
}
