/**
 * Notification Engine — Queue Service (PR6)
 * DB-backed job queue. Retry policy: attempt 1→+30s, 2→+5m, 3→+30m, >3→DEAD
 */

import type { NotificationChannel, NotificationJob } from '@prisma/client'
import { createHash } from 'node:crypto'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'

const RETRY_DELAYS_MS = [30_000, 5 * 60_000, 30 * 60_000] // +30s / +5m / +30m
const MAX_RETRY_ATTEMPTS = 3

const NON_RETRYABLE = new Set([
  'INVALID_RECIPIENT',
  'EXPIRED_TOKEN',
  'OPTED_OUT',
  'COST_CAP_EXCEEDED',
  'RATE_CAP_EXCEEDED',
  'RATE_LIMITED',
  'NOT_REGISTERED',
])

export interface EnqueueInput {
  businessId: string
  userId: string
  eventKey: string
  channel: NotificationChannel
  payload: Record<string, unknown>
  recipientHash: string
  pushTokenId?: string
  scheduledAt?: Date
}

export interface EnqueueResult {
  jobId: string
  idempotencyKey: string
  skipped: boolean
}

// Idempotency: sha256(userId:eventKey:channel:60s-bucket) → first 40 hex chars
function buildIdempotencyKey(
  userId: string,
  eventKey: string,
  channel: NotificationChannel,
): string {
  // 60-second bucket: floor(epochSeconds / 60)
  const bucket = Math.floor(Date.now() / 1000 / 60)
  return createHash('sha256')
    .update(`${userId}:${eventKey}:${channel}:${bucket}`)
    .digest('hex')
    .slice(0, 40)
}

export async function enqueue(input: EnqueueInput): Promise<EnqueueResult> {
  const idempotencyKey = buildIdempotencyKey(input.userId, input.eventKey, input.channel)

  // Check for duplicate within this 60s window
  const existing = await prisma.notificationJob.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  })

  if (existing) {
    logger.debug('notification.queue.deduped', {
      userId: input.userId, eventKey: input.eventKey, channel: input.channel, jobId: existing.id,
    })
    return { jobId: existing.id, idempotencyKey, skipped: true }
  }

  const job = await prisma.notificationJob.create({
    data: {
      businessId: input.businessId,
      userId: input.userId,
      eventKey: input.eventKey,
      channel: input.channel,
      status: 'QUEUED',
      deliveryStatus: 'UNKNOWN',
      idempotencyKey,
      recipientChannel: input.channel,
      pushTokenId: input.pushTokenId ?? null,
      recipientHash: input.recipientHash,
      payload: input.payload,
      scheduledAt: input.scheduledAt ?? new Date(),
    },
    select: { id: true },
  })

  logger.debug('notification.queue.enqueued', {
    jobId: job.id, eventKey: input.eventKey, channel: input.channel,
  })

  return { jobId: job.id, idempotencyKey, skipped: false }
}

export async function claimBatch(
  workerId: string,
  limit = 50,
): Promise<NotificationJob[]> {
  const jobs = await prisma.$queryRaw<NotificationJob[]>`
    UPDATE "NotificationJob"
    SET status = 'PROCESSING'::"NotificationJobStatus",
        "claimedAt" = now(),
        "claimedBy" = ${workerId}
    WHERE id IN (
      SELECT id FROM "NotificationJob"
      WHERE status = 'QUEUED'::"NotificationJobStatus"
        AND "scheduledAt" <= now()
      ORDER BY "scheduledAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `

  if (jobs.length > 0) {
    logger.debug('notification.queue.claimed_batch', { workerId, count: jobs.length })
  }

  return jobs
}

export async function markSent(
  jobId: string,
  externalId: string | undefined,
  costPaise: number,
): Promise<void> {
  await prisma.notificationJob.updateMany({
    where: { id: jobId, status: 'PROCESSING' },
    data: {
      status: 'DISPATCHED',
      externalId: externalId ?? null,
      costPaise,
      processedAt: new Date(),
    },
  })

  logger.debug('notification.queue.mark_sent', { jobId, externalId, costPaise })
}

export async function markFailed(
  jobId: string,
  errorCode: string,
  retryable: boolean,
): Promise<void> {
  const job = await prisma.notificationJob.findUnique({
    where: { id: jobId },
    select: { retryCount: true },
  })

  if (!job) {
    logger.warn('notification.queue.mark_failed.not_found', { jobId })
    return
  }

  const nextAttempt = job.retryCount + 1
  const isNonRetryable = NON_RETRYABLE.has(errorCode) || !retryable
  const exceedsMax = nextAttempt > MAX_RETRY_ATTEMPTS

  if (isNonRetryable || exceedsMax) {
    await markDead(jobId, errorCode)
    return
  }

  // Schedule retry with backoff
  const delayMs = RETRY_DELAYS_MS[job.retryCount] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!
  const scheduledAt = new Date(Date.now() + delayMs)

  await prisma.notificationJob.updateMany({
    where: { id: jobId, status: 'PROCESSING' },
    data: {
      status: 'QUEUED',
      failureCode: errorCode,
      failedAt: new Date(),
      retryCount: nextAttempt,
      scheduledAt,
      claimedAt: null,
      claimedBy: null,
    },
  })

  logger.warn('notification.queue.mark_failed.retry_scheduled', {
    jobId, errorCode, attempt: nextAttempt, scheduledAt,
  })
}

export async function markDead(jobId: string, reason: string): Promise<void> {
  await prisma.notificationJob.updateMany({
    where: { id: jobId, status: { in: ['PROCESSING', 'QUEUED', 'FAILED'] } },
    data: {
      status: 'DEAD',
      failureCode: reason,
      failedAt: new Date(),
    },
  })

  logger.warn('notification.queue.mark_dead', { jobId, reason })
}

export async function reclaimStale(staleMins = 5): Promise<number> {
  const cutoff = new Date(Date.now() - staleMins * 60 * 1000)

  const result = await prisma.notificationJob.updateMany({
    where: {
      status: 'PROCESSING',
      claimedAt: { lt: cutoff },
    },
    data: {
      status: 'QUEUED',
      claimedAt: null,
      claimedBy: null,
    },
  })

  if (result.count > 0) {
    logger.warn('notification.queue.reclaimed_stale', { count: result.count, staleMins })
  }

  return result.count
}
