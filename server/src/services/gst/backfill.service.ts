/**
 * GST Backfill Service — public API: preview, execute, getBackfillStatus.
 *
 * Job state storage: see backfill-store.ts.
 *   - Redis (7-day TTL) when REDIS_URL is set.
 *   - In-memory Map as fallback (single-process dev; state lost on restart).
 *
 * Background job: see backfill-worker.ts.
 * Transaction boundaries: one Prisma $transaction per document (Architecture §7.4).
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { saveJobState, saveKeyMapping, loadJobIdByKey, loadJobState } from './backfill-store.js'
import type { BackfillJobState } from './backfill-store.js'
import { runBackfillJob } from './backfill-worker.js'

const STALE_HEARTBEAT_MS = 2 * 60 * 60 * 1000 // 2 hours

// ─── Preview ──────────────────────────────────────────────────────────────────

export interface BackfillPreviewResult {
  untaggedProductCount: number
  untaggedProductValue: number   // paise — sum of salePrice for untagged products
  nullPosInvoiceCount: number
  nullPosTaxableValue: number    // paise — sum of totalTaxableValue on null-POS docs
}

export async function previewBackfill(businessId: string): Promise<BackfillPreviewResult> {
  const [productAgg, invoiceAgg] = await Promise.all([
    prisma.product.aggregate({
      where: { businessId, taxCategoryId: null, isDeleted: false },
      _count: { id: true },
      _sum: { salePrice: true },
    }),
    prisma.document.aggregate({
      where: { businessId, placeOfSupply: null, isDeleted: false },
      _count: { id: true },
      _sum: { totalTaxableValue: true },
    }),
  ])

  return {
    untaggedProductCount: productAgg._count.id,
    untaggedProductValue: Number(productAgg._sum.salePrice ?? 0),
    nullPosInvoiceCount: invoiceAgg._count.id,
    nullPosTaxableValue: Number(invoiceAgg._sum.totalTaxableValue ?? 0),
  }
}

// ─── Execute ─────────────────────────────────────────────────────────────────

export interface ExecuteBackfillPayload {
  defaultTaxCategoryId: string
  dateRange: [Date, Date]
  setPositionFromParty: boolean
}

export interface ExecuteBackfillResult {
  jobId: string
  status: 'RUNNING'
}

export async function executeBackfill(
  businessId: string,
  payload: ExecuteBackfillPayload,
  userId: string,
  idempotencyKey: string,
): Promise<ExecuteBackfillResult> {
  // Replay: return same jobId if this key was already used for this business
  const existingJobId = await loadJobIdByKey(idempotencyKey, businessId)
  if (existingJobId) {
    logger.info('BACKFILL_IDEMPOTENCY_REPLAY', { idempotencyKey, jobId: existingJobId })
    return { jobId: existingJobId, status: 'RUNNING' }
  }

  // Unique jobId derived from idempotency key + timestamp
  const safeKey = idempotencyKey.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36)
  const jobId = `${safeKey}-${Date.now()}`

  const [startDate, endDate] = payload.dateRange

  const [productRows, documentRows] = await Promise.all([
    prisma.product.findMany({
      where: { businessId, taxCategoryId: null, isDeleted: false },
      select: { id: true },
    }),
    prisma.document.findMany({
      where: {
        businessId,
        placeOfSupply: null,
        isDeleted: false,
        documentDate: { gte: startDate, lte: endDate },
      },
      select: { id: true },
    }),
  ])

  const productIds = productRows.map(p => p.id)
  const documentIds = documentRows.map(d => d.id)
  const total = productIds.length + documentIds.length

  const initialState: BackfillJobState = {
    status: 'RUNNING',
    processed: 0,
    total,
    errors: [],
    heartbeat: Date.now(),
    businessId,
  }

  await saveJobState(jobId, initialState)
  await saveKeyMapping(idempotencyKey, jobId, businessId)

  // Fire-and-forget — non-blocking (spec requirement)
  setImmediate(() => {
    runBackfillJob(jobId, businessId, userId, payload, productIds, documentIds)
      .catch(err => logger.error('BACKFILL_JOB_FATAL', { jobId, error: (err as Error).message }))
  })

  return { jobId, status: 'RUNNING' }
}

// ─── Status ───────────────────────────────────────────────────────────────────

export interface BackfillStatusResult {
  status: import('./backfill-store.js').BackfillStatus
  processed: number
  total: number
  errors: import('./backfill-store.js').BackfillError[]
}

export async function getBackfillStatus(businessId: string, jobId: string): Promise<BackfillStatusResult | null> {
  const state = await loadJobState(jobId)
  if (!state) return null
  if (state.businessId !== businessId) return null

  // Detect stale heartbeat — transition to INTERRUPTED
  if (state.status === 'RUNNING' && Date.now() - state.heartbeat > STALE_HEARTBEAT_MS) {
    state.status = 'INTERRUPTED'
    await saveJobState(jobId, state)
    logger.warn('BACKFILL_JOB_INTERRUPTED', { jobId, lastHeartbeat: state.heartbeat })
  }

  return {
    status: state.status,
    processed: state.processed,
    total: state.total,
    errors: state.errors,
  }
}
