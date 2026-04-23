/**
 * API GET Cache — Dexie-backed offline reads
 *
 * Opt-in: pass `cacheReads: true` on `api()` calls that should serve from
 * IndexedDB when the network drops. We do NOT cache by default because many
 * endpoints return PII (phone, balances, transactions) and a wide cache
 * surface enlarges the cross-session leak risk if a different user signs
 * in on the same device. Cache is cleared on logout via clearApiCache().
 *
 * Strategy: store the parsed JSON envelope keyed by full path+query. On
 * a successful response, write through. On network failure, look up the
 * path; if a fresh-enough entry exists, return its value as if the request
 * succeeded (with `__fromCache: true` injectable for callers that care).
 *
 * Cap: 200 entries, LRU-evicted by `cachedAt`.
 * TTL: 7 days; older entries are dropped on read.
 */

import Dexie from 'dexie'

const DB_NAME = 'hisaabpro-api-cache'
const DB_VERSION = 1
const CACHE_MAX_ENTRIES = 200
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000

interface CachedResponse {
  /** Full path including querystring — primary key */
  key: string
  /** Stringified JSON envelope as returned by api() (the inner `data` field) */
  body: string
  cachedAt: number
}

class ApiCacheDB extends Dexie {
  cache!: Dexie.Table<CachedResponse, string>

  constructor() {
    super(DB_NAME)
    this.version(DB_VERSION).stores({ cache: 'key, cachedAt' })
  }
}

const db = new ApiCacheDB()

export async function writeApiCache(key: string, value: unknown): Promise<void> {
  try {
    await db.cache.put({ key, body: JSON.stringify(value), cachedAt: Date.now() })
    // LRU eviction — when over the cap, drop oldest
    const count = await db.cache.count()
    if (count > CACHE_MAX_ENTRIES) {
      const overflow = count - CACHE_MAX_ENTRIES
      const oldest = await db.cache.orderBy('cachedAt').limit(overflow).primaryKeys()
      if (oldest.length > 0) await db.cache.bulkDelete(oldest)
    }
  } catch {
    // Quota / private browsing — silent
  }
}

export async function readApiCache<T>(key: string): Promise<T | null> {
  try {
    const entry = await db.cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      await db.cache.delete(key).catch(() => {})
      return null
    }
    return JSON.parse(entry.body) as T
  } catch {
    return null
  }
}

/** Clear all cached responses. Call on logout / business switch. */
export async function clearApiCache(): Promise<void> {
  try {
    await db.cache.clear()
  } catch {
    // Silent — IDB may be unavailable
  }
}
