/**
 * Batch Expiry Alerts Service — BAT-04
 *
 * Daily cron (06:00 IST) scans every business for batches nearing or past
 * their expiry date and creates StockAlert rows of type EXPIRY_NEAR /
 * EXPIRY_PASSED.  Re-running the cron on the same day is idempotent.
 *
 * Per-business transaction (F-06): one $transaction per business, committed
 * before moving on, so one bad tenant never rolls back others.
 */

import { prisma } from '../../lib/prisma.js'
import { istMidnightUtc } from '../../lib/date.js'
import logger from '../../lib/logger.js'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunResult {
  businessesProcessed: number
  alertsCreated: number
  alertsResolved: number
}

interface BatchCandidate {
  id: string
  productId: string
  batchNumber: string
  expiryDate: Date
  currentStock: number
  productName: string
}

// ---------------------------------------------------------------------------
// Inline auto-resolve helper (also exported for batch-claim use)
// ---------------------------------------------------------------------------

/**
 * Resolves all ACTIVE expiry alerts (EXPIRY_NEAR + EXPIRY_PASSED) for a
 * given batchId.  Call inside an outer $transaction after stock drops to 0.
 * Returns the number of alerts resolved.
 */
export async function resolveBatchAlerts(
  tx: TxClient,
  batchId: string
): Promise<number> {
  const result = await tx.stockAlert.updateMany({
    where: {
      batchId,
      status: 'ACTIVE',
      alertType: { in: ['EXPIRY_NEAR', 'EXPIRY_PASSED'] },
    },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
    },
  })
  return result.count
}

// ---------------------------------------------------------------------------
// Per-business expiry scan
// ---------------------------------------------------------------------------

async function processBusinessExpiry(
  tx: TxClient,
  businessId: string,
  alertDays: number,
  now: Date
): Promise<{ created: number; resolved: number }> {
  const thresholdDate = new Date(now.getTime() + alertDays * 24 * 60 * 60 * 1000)

  // Fetch all candidate batches: non-deleted, in-stock, with expiry within window
  const candidates = await tx.$queryRaw<BatchCandidate[]>`
    SELECT
      b.id,
      b."productId",
      b."batchNumber",
      b."expiryDate",
      b."currentStock"::int AS "currentStock",
      p.name AS "productName"
    FROM "Batch" b
    JOIN "Product" p ON p.id = b."productId"
    WHERE b."businessId" = ${businessId}
      AND b."isDeleted" = false
      AND b."currentStock" > 0
      AND b."expiryDate" IS NOT NULL
      AND b."expiryDate" <= ${thresholdDate}
  `

  let created = 0
  let resolved = 0

  for (const c of candidates) {
    const alertType = c.expiryDate <= now ? 'EXPIRY_PASSED' : 'EXPIRY_NEAR'

    // Dedupe: skip if there's already an ACTIVE alert of this type for this batch
    const existing = await tx.stockAlert.findFirst({
      where: {
        businessId,
        batchId: c.id,
        alertType,
        status: 'ACTIVE',
      },
      select: { id: true },
    })

    if (existing) continue

    // EXPIRY_PASSED: auto-resolve any open EXPIRY_NEAR for the same batch
    if (alertType === 'EXPIRY_PASSED') {
      const r = await tx.stockAlert.updateMany({
        where: {
          businessId,
          batchId: c.id,
          alertType: 'EXPIRY_NEAR',
          status: 'ACTIVE',
        },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      })
      resolved += r.count
    }

    // Create the new alert
    await tx.stockAlert.create({
      data: {
        businessId,
        productId: c.productId,
        batchId: c.id,
        alertType,
        threshold: 0,
        currentQty: c.currentStock,
        status: 'ACTIVE',
      },
    })

    logger.info('batch-expiry-alert.created', {
      businessId,
      batchId: c.id,
      batchNumber: c.batchNumber,
      productName: c.productName,
      alertType,
      expiryDate: c.expiryDate.toISOString(),
    })

    created++
  }

  // Auto-resolve alerts whose batch has since sold out (stock = 0 mid-day)
  const soldOut = await tx.$executeRaw`
    UPDATE "StockAlert" sa
    SET status = 'RESOLVED', "resolvedAt" = NOW()
    FROM "Batch" b
    WHERE sa."batchId" = b.id
      AND sa."businessId" = ${businessId}
      AND sa.status = 'ACTIVE'
      AND sa."alertType" IN ('EXPIRY_NEAR', 'EXPIRY_PASSED')
      AND b."currentStock" <= 0
  `
  resolved += Number(soldOut)

  return { created, resolved }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Iterates all businesses (streamed in pages of 200) and runs the per-business
 * expiry scan inside a per-business $transaction.
 */
export async function runBatchExpiryAlerts(
  opts: { now?: Date } = {}
): Promise<RunResult> {
  const now = istMidnightUtc(opts.now ?? new Date())

  let businessesProcessed = 0
  let alertsCreated = 0
  let alertsResolved = 0

  let cursor: string | undefined
  const PAGE = 200

  while (true) {
    const businesses = await prisma.business.findMany({
      where: { isActive: true },
      select: { id: true, expiryAlertDays: true },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    })

    if (businesses.length === 0) break

    for (const biz of businesses) {
      const alertDays = biz.expiryAlertDays ?? 30

      // alertDays = 0 means "no advance alerts" — still detect EXPIRY_PASSED
      // (threshold = 0 so thresholdDate = now → only batches already expired)
      try {
        const { created, resolved } = await prisma.$transaction(async (tx) => {
          return processBusinessExpiry(tx, biz.id, alertDays, now)
        })

        alertsCreated += created
        alertsResolved += resolved
        businessesProcessed++
      } catch (err) {
        logger.error('batch-expiry-alert.business_error', {
          businessId: biz.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    cursor = businesses[businesses.length - 1].id
    if (businesses.length < PAGE) break
  }

  return { businessesProcessed, alertsCreated, alertsResolved }
}
