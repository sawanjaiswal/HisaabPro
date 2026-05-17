/**
 * Loyalty #125 — Expiry cron.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §2.7 (expiry job),
 * §11.7-11.8 (analytics).
 *
 * Schedule: 04:15 IST daily (registered in lib/cron-scheduler.ts).
 *
 * Idempotency contract (test 12.9):
 *   - Each AC row that has expired (`expiresAt < now`) AND does NOT yet have
 *     a matching EX row gets exactly one EX row inserted with the inverse
 *     delta.
 *   - "Matching" means EX.note carries `[expiry of ac:<acRowId>]`. We use
 *     this string sentinel because schema does not carry an FK between EX
 *     and the AC it expires — keeping the schema flat.
 *   - Running the job twice on the same day MUST write zero new rows the
 *     second time (test 12.9).
 *
 * Tenanting: iterate Business rows that have ANY expired AC; per-business
 * isolation so one tenant's failure does not abort the others.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { analyticsEmit } from '../../lib/analytics.js'

interface ExpirySummary {
  businessId: string
  acRowsExpired: number
  exRowsWritten: number
}

const EX_NOTE_PREFIX = '[expiry of ac:'

function exNoteFor(acRowId: string): string {
  return `${EX_NOTE_PREFIX}${acRowId}]`
}

// ─── Per-business expiry pass ──────────────────────────────────────────────

async function expireForBusiness(businessId: string, now: Date): Promise<ExpirySummary> {
  // Load AC rows whose expiresAt is in the past for this business.
  // (Bound the page; if there are >5k expired-but-unhandled rows on a single
  // night, surface it via summary count and let ops investigate.)
  const PAGE = 5000

  const expiredAc = await prisma.loyaltyLedger.findMany({
    where: {
      businessId,
      type: 'AC',
      expiresAt: { lt: now },
    },
    select: { id: true, partyId: true, delta: true },
    take: PAGE,
  })

  if (expiredAc.length === 0) {
    return { businessId, acRowsExpired: 0, exRowsWritten: 0 }
  }

  // Find which of these already have a corresponding EX row.
  const exNotes = expiredAc.map(r => exNoteFor(r.id))
  const existing = await prisma.loyaltyLedger.findMany({
    where: { businessId, type: 'EX', note: { in: exNotes } },
    select: { note: true },
  })
  const handled = new Set(existing.map(r => r.note))

  const toInsert = expiredAc.filter(r => !handled.has(exNoteFor(r.id)))
  if (toInsert.length === 0) {
    return { businessId, acRowsExpired: expiredAc.length, exRowsWritten: 0 }
  }

  // Insert EX rows in one batch — sign convention from loyalty.constants:
  // EX is negative. We negate the original AC's positive delta.
  await prisma.loyaltyLedger.createMany({
    data: toInsert.map(ac => ({
      businessId,
      partyId: ac.partyId,
      type: 'EX',
      delta: -Math.abs(ac.delta),
      expiryRunId: null,
      note: exNoteFor(ac.id),
      earnedAt: now,
      // EX rows have no further expiry — they ARE the expiry.
    })),
  })

  return { businessId, acRowsExpired: expiredAc.length, exRowsWritten: toInsert.length }
}

// ─── Cron entry point ──────────────────────────────────────────────────────

export async function runLoyaltyExpiryCron(now: Date = new Date()): Promise<{
  businessesProcessed: number
  totalAcExpired: number
  totalExWritten: number
}> {
  logger.info('loyalty-expiry.start', { now: now.toISOString() })

  // Iterate businesses that have ANY expired AC rows (avoid scanning all
  // businesses — cheaper than `business.findMany` for small tenants).
  const businessesWithExpired = await prisma.loyaltyLedger.findMany({
    where: { type: 'AC', expiresAt: { lt: now } },
    select: { businessId: true },
    distinct: ['businessId'],
  })

  let businessesProcessed = 0
  let totalAcExpired = 0
  let totalExWritten = 0

  for (const { businessId } of businessesWithExpired) {
    try {
      const summary = await expireForBusiness(businessId, now)
      businessesProcessed += 1
      totalAcExpired += summary.acRowsExpired
      totalExWritten += summary.exRowsWritten

      if (summary.exRowsWritten > 0) {
        analyticsEmit('loyalty_redeemed', {
          businessId,
          source: 'expiry',
          acRowsExpired: summary.acRowsExpired,
          exRowsWritten: summary.exRowsWritten,
          runAt: now.toISOString(),
        })
      }
    } catch (e) {
      logger.error('loyalty-expiry.business_error', {
        businessId,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const result = { businessesProcessed, totalAcExpired, totalExWritten }
  logger.info('loyalty-expiry.complete', result)
  return result
}
