/**
 * Backfill job state storage — Redis when REDIS_URL is set, in-memory otherwise.
 *
 * LIMITATION: The in-memory fallback is single-process only. Job state is lost
 * on process restart. Use Redis in any multi-process or production environment.
 */

import logger from '../../lib/logger.js'

export type BackfillStatus = 'RUNNING' | 'COMPLETED' | 'INTERRUPTED'

export interface BackfillError {
  documentId: string
  error: string
}

export interface BackfillJobState {
  status: BackfillStatus
  processed: number
  total: number
  errors: BackfillError[]
  heartbeat: number // epoch ms — updated each document iteration
  businessId: string
}

const JOB_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

// In-memory fallback (single-process dev only)
const memoryJobStore = new Map<string, BackfillJobState>()
const memoryKeyMap = new Map<string, { jobId: string; businessId: string }>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisLike = { setex: (k: string, ttl: number, v: string) => Promise<unknown>; get: (k: string) => Promise<string | null> }

let _redis: RedisLike | null | undefined

async function getRedis(): Promise<RedisLike | null> {
  if (_redis !== undefined) return _redis
  if (!process.env.REDIS_URL) { _redis = null; return null }

  try {
    // Use Function() to bypass tsc module resolution — ioredis is an optional dep.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await (Function('s', 'return import(s)') as (s: string) => Promise<any>)('ioredis')
    const Redis = mod.default ?? mod.Redis ?? mod
    const client = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
    await client.connect()
    _redis = client as RedisLike
    return _redis
  } catch {
    logger.warn('BACKFILL_REDIS_UNAVAILABLE: falling back to in-memory job store')
    _redis = null
    return null
  }
}

// ─── Job state ──────────────────────────────────────────────────────────────

export async function saveJobState(jobId: string, state: BackfillJobState): Promise<void> {
  const redis = await getRedis()
  if (redis) {
    await redis.setex(`backfill:job:${jobId}`, JOB_TTL_SECONDS, JSON.stringify(state))
  } else {
    memoryJobStore.set(jobId, state)
  }
}

export async function loadJobState(jobId: string): Promise<BackfillJobState | null> {
  const redis = await getRedis()
  if (redis) {
    const raw = await redis.get(`backfill:job:${jobId}`)
    if (!raw) return null
    return JSON.parse(raw) as BackfillJobState
  }
  return memoryJobStore.get(jobId) ?? null
}

// ─── Idempotency key → jobId mapping ────────────────────────────────────────

export async function saveKeyMapping(key: string, jobId: string, businessId: string): Promise<void> {
  const redis = await getRedis()
  if (redis) {
    await redis.setex(`backfill:key:${key}`, JOB_TTL_SECONDS, JSON.stringify({ jobId, businessId }))
  } else {
    memoryKeyMap.set(key, { jobId, businessId })
  }
}

export async function loadJobIdByKey(key: string, businessId: string): Promise<string | null> {
  const redis = await getRedis()
  if (redis) {
    const raw = await redis.get(`backfill:key:${key}`)
    if (!raw) return null
    const m = JSON.parse(raw) as { jobId: string; businessId: string }
    return m.businessId === businessId ? m.jobId : null
  }
  const m = memoryKeyMap.get(key)
  if (!m || m.businessId !== businessId) return null
  return m.jobId
}
