/**
 * Audit #5 — OAuth state + PKCE verifier store for the Drive connect flow.
 *
 * Each `connect` issues an opaque random `state` bound to the initiating
 * user. On `callback`, the state is consumed (single-use) and the caller MUST
 * assert `record.userId === req.user.userId` — this prevents an attacker from
 * attaching their own Google account to a victim's session (account-attach).
 *
 * Backed by Redis when REDIS_URL is set; in-memory Map fallback (single-process
 * dev only) with TTL sweep. Mirrors gst/backfill-store.ts.
 */

import logger from '../../lib/logger.js'

const STATE_TTL_SECONDS = 10 * 60 // 10 min — OAuth round-trip window

export interface DriveOAuthState {
  userId: string
  codeVerifier: string
  expiresAt: number // epoch ms
}

// In-memory fallback (single-process dev only)
const memoryStore = new Map<string, DriveOAuthState>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisLike = {
  setex: (k: string, ttl: number, v: string) => Promise<unknown>
  get: (k: string) => Promise<string | null>
  del: (k: string) => Promise<unknown>
}

let _redis: RedisLike | null | undefined

async function getRedis(): Promise<RedisLike | null> {
  if (_redis !== undefined) return _redis
  if (!process.env.REDIS_URL) {
    _redis = null
    return null
  }
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
    logger.warn('DRIVE_OAUTH_REDIS_UNAVAILABLE: falling back to in-memory state store')
    _redis = null
    return null
  }
}

const key = (state: string) => `drive:oauth:state:${state}`

export async function saveOAuthState(state: string, record: DriveOAuthState): Promise<void> {
  const redis = await getRedis()
  if (redis) {
    await redis.setex(key(state), STATE_TTL_SECONDS, JSON.stringify(record))
  } else {
    memoryStore.set(state, record)
  }
}

/**
 * Atomically read-and-delete the state (single-use). Returns null when the
 * state is unknown, already consumed, or expired.
 */
export async function consumeOAuthState(state: string): Promise<DriveOAuthState | null> {
  const redis = await getRedis()
  if (redis) {
    const raw = await redis.get(key(state))
    await redis.del(key(state))
    if (!raw) return null
    const record = JSON.parse(raw) as DriveOAuthState
    return record.expiresAt > Date.now() ? record : null
  }
  const record = memoryStore.get(state) ?? null
  memoryStore.delete(state)
  if (!record) return null
  return record.expiresAt > Date.now() ? record : null
}
