/**
 * Admin Broadcast Service (PR8)
 * Resolves users by subscription tier and enqueues NotificationJobs.
 * Enforces: 2 broadcasts per super-admin per 24h, idempotency, audit log.
 */

import { createHash } from 'node:crypto'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { enqueue } from '../notifications/notification-queue.service.js'
import type { NotificationChannel } from '@prisma/client'

// ─── Rate limit: in-memory map (MVP, resets on restart) ───────────────────────

const BROADCAST_LIMIT = 2
const WINDOW_MS = 24 * 60 * 60 * 1000 // 24h

interface RateBucket {
  count: number
  windowStart: number
}

const rateBuckets = new Map<string, RateBucket>()

export function checkBroadcastRateLimit(adminId: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const bucket = rateBuckets.get(adminId)

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    rateBuckets.set(adminId, { count: 0, windowStart: now })
    return { allowed: true, remaining: BROADCAST_LIMIT }
  }

  const remaining = BROADCAST_LIMIT - bucket.count
  return { allowed: remaining > 0, remaining }
}

export function consumeBroadcastRateLimit(adminId: string): void {
  const now = Date.now()
  const bucket = rateBuckets.get(adminId)

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    rateBuckets.set(adminId, { count: 1, windowStart: now })
  } else {
    bucket.count += 1
  }
}

// ─── Idempotency cache: (adminId:idempotencyKey) → bodyHash + cachedResponse ──

interface IdempotencyEntry {
  bodyHash: string
  response: BroadcastResult
  expiresAt: number
}

const idempotencyCache = new Map<string, IdempotencyEntry>()

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000 // 24h

function cacheKey(adminId: string, idempotencyKey: string): string {
  return `${adminId}:${idempotencyKey}`
}

export function hashBody(body: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex')
}

export function checkIdempotency(
  adminId: string,
  idempotencyKey: string,
  bodyHash: string,
): { status: 'new' } | { status: 'replay'; response: BroadcastResult } | { status: 'conflict' } {
  const key = cacheKey(adminId, idempotencyKey)
  const entry = idempotencyCache.get(key)

  if (!entry) return { status: 'new' }
  if (Date.now() > entry.expiresAt) {
    idempotencyCache.delete(key)
    return { status: 'new' }
  }
  if (entry.bodyHash === bodyHash) return { status: 'replay', response: entry.response }
  return { status: 'conflict' }
}

export function storeIdempotency(
  adminId: string,
  idempotencyKey: string,
  bodyHash: string,
  response: BroadcastResult,
): void {
  const key = cacheKey(adminId, idempotencyKey)
  idempotencyCache.set(key, { bodyHash, response, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS })
}

// ─── Core broadcast logic ──────────────────────────────────────────────────────

export interface BroadcastInput {
  adminId: string
  title: string
  body: string
  deepLinkUrl?: string
  targetTier: 'free' | 'pro' | 'business'
  idempotencyKey: string
}

export interface BroadcastResult {
  jobsQueued: number
  idempotencyKey: string
}

/** Map tier label → Subscription.planTier DB value (uppercase). */
function tierToDbValue(tier: 'free' | 'pro' | 'business'): string {
  return tier.toUpperCase()
}

export async function executeBroadcast(input: BroadcastInput): Promise<BroadcastResult> {
  const dbTier = tierToDbValue(input.targetTier)

  // Resolve businesses on the target tier
  const subscriptions = await prisma.subscription.findMany({
    where: { planTier: dbTier, status: 'ACTIVE' },
    select: { businessId: true },
  })

  const businessIds = subscriptions.map((s) => s.businessId)

  // Resolve owner users for those businesses
  const businessUsers = await prisma.businessUser.findMany({
    where: {
      businessId: { in: businessIds },
      isActive: true,
      status: 'ACTIVE',
      role: 'owner',
    },
    select: { userId: true, businessId: true },
  })

  const channels: NotificationChannel[] = ['IN_APP']
  const eventKey = 'ADMIN_BROADCAST'

  let queued = 0
  for (const bu of businessUsers) {
    const recipientHash = createHash('sha256').update(bu.userId).digest('hex')
    const result = await enqueue({
      businessId: bu.businessId,
      userId: bu.userId,
      eventKey,
      channel: channels[0]!,
      recipientHash,
      payload: {
        title: input.title,
        body: input.body,
        deepLinkUrl: input.deepLinkUrl ?? null,
      },
    })
    if (!result.skipped) queued++
  }

  // Audit log via existing AdminAction table
  await prisma.adminAction.create({
    data: {
      adminId: input.adminId,
      action: 'BROADCAST_NOTIFICATION',
      targetType: 'TIER',
      targetId: input.targetTier,
      metadata: {
        targetTier: input.targetTier,
        userCount: queued,
        bodyPreview: input.body.slice(0, 200),
        idempotencyKey: input.idempotencyKey,
        title: input.title,
      },
    },
  }).catch((err: unknown) => {
    logger.error('broadcast.audit_log_failed', { err, adminId: input.adminId })
  })

  logger.info('broadcast.executed', {
    adminId: input.adminId,
    targetTier: input.targetTier,
    jobsQueued: queued,
    idempotencyKey: input.idempotencyKey,
  })

  return { jobsQueued: queued, idempotencyKey: input.idempotencyKey }
}
