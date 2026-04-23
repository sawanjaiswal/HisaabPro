import logger from '../../lib/logger.js'

// ---------------------------------------------------------------------------
// Store interface — pluggable backend
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  count: number
  resetAt: number
}

/**
 * Pluggable rate limit store.
 * Implement this interface to swap in Redis or any other backend.
 */
export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitResult>
  reset(key: string): Promise<void>
}

// ---------------------------------------------------------------------------
// MemoryStore — default, zero dependencies
// ---------------------------------------------------------------------------

interface MemoryEntry {
  count: number
  resetAt: number
}

class MemoryStore implements RateLimitStore {
  private readonly entries = new Map<string, MemoryEntry>()
  private static readonly MAX_ENTRIES = 50_000 // prevent unbounded memory growth

  constructor() {
    // Evict expired entries every 60 seconds
    setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.entries) {
        if (now > entry.resetAt) this.entries.delete(key)
      }
    }, 60_000).unref()
  }

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now()
    const existing = this.entries.get(key)

    if (!existing || now > existing.resetAt) {
      // Evict oldest entry if at capacity (FIFO)
      if (this.entries.size >= MemoryStore.MAX_ENTRIES) {
        const firstKey = this.entries.keys().next().value
        if (firstKey !== undefined) this.entries.delete(firstKey)
      }
      const entry: MemoryEntry = { count: 1, resetAt: now + windowMs }
      this.entries.set(key, entry)
      return { count: 1, resetAt: entry.resetAt }
    }

    existing.count++
    return { count: existing.count, resetAt: existing.resetAt }
  }

  async reset(key: string): Promise<void> {
    this.entries.delete(key)
  }
}

// ---------------------------------------------------------------------------
// RedisStore — used when REDIS_URL is set and ioredis is available
// ---------------------------------------------------------------------------

async function tryBuildRedisStore(): Promise<RateLimitStore | null> {
  if (!process.env.REDIS_URL) return null

  try {
    // Dynamic import — only loads if ioredis is installed
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — ioredis is an optional peer dependency
    const { default: Redis } = await import('ioredis')
    const client = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
    await client.connect()

    return {
      async increment(key: string, windowMs: number): Promise<RateLimitResult> {
        const windowSec = Math.ceil(windowMs / 1000)
        const pipeline = client.pipeline()
        pipeline.incr(key)
        pipeline.pttl(key)
        const results = await pipeline.exec()

        const count = (results?.[0]?.[1] as number) ?? 1
        const pttl = (results?.[1]?.[1] as number) ?? windowMs

        // Set expiry only on first increment
        if (count === 1) {
          await client.expire(key, windowSec)
        }

        const resetAt = Date.now() + (pttl > 0 ? pttl : windowMs)
        return { count, resetAt }
      },

      async reset(key: string): Promise<void> {
        await client.del(key)
      },
    }
  } catch {
    // ioredis not installed or Redis unreachable — fall back to memory
    logger.warn('rate-limit: Redis unavailable, falling back to MemoryStore')
    return null
  }
}

// Singleton store (resolved once at startup)
let _store: RateLimitStore | null = null

export async function getStore(): Promise<RateLimitStore> {
  if (_store) return _store
  _store = (await tryBuildRedisStore()) ?? new MemoryStore()
  return _store
}

// Eagerly initialise so the first request isn't delayed
getStore().catch((err) => {
  logger.warn('Rate limit store init failed, falling back to memory store', {
    error: (err as Error).message,
  })
  _store = new MemoryStore()
})
