// Canonical local-first read-cache module (SSOT: src/db/read-cache.ts).
//
// Owns BOTH tiers of the read-cache architecture:
// - T0: in-memory Map (< 1 ms), scoped to the tab lifecycle.
// - T1: Dexie IndexedDB (< 5 ms), survives page reloads, process restarts and offline.
//
// Contract:
// 1. Keyed by scope (e.g. 'business:<id>', 'user:<id>', 'global'), never global without intent.
// 2. schemaVersion validation: a stored payload from an older schema version is treated
//    as a cache miss and evicted.
// 3. Best-effort resilience: IndexedDB errors are caught and return null gracefully.
// 4. Scope-based eviction on business switch and full clearance on logout.
// 5. Device-local kill-switch (hisaabpro.readcache.off) degrades cleanly to network-only.
import { db, type ReadCacheEntry } from './db'

export type LoadStatus = 'LOADING' | 'STALE' | 'READY' | 'ERROR'
export type { ReadCacheEntry }

export const STALE_AFTER_MS = 5 * 60_000
export const CACHE_SCHEMA_VERSION = 1

/**
 * Device-local kill-switch. `localStorage.setItem('hisaabpro.readcache.off','1')` then reload
 * makes every read a miss and every write a no-op — the app falls back to network-only.
 */
export const DISABLED = (() => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('hisaabpro.readcache.off') === '1'
  } catch {
    return false
  }
})()

export interface ReadCacheStats {
  t0Hits: number
  t1Hits: number
  misses: number
  errors: number
  lastT0Ms: number | null
  lastT1Ms: number | null
}

const stats: ReadCacheStats = {
  t0Hits: 0,
  t1Hits: 0,
  misses: 0,
  errors: 0,
  lastT0Ms: null,
  lastT1Ms: null,
}

/** Returns a snapshot of current cache hit/miss/timing counters (no PII, no payloads). */
export function readCacheStats(): ReadCacheStats {
  return { ...stats }
}

/** Resets cache observability stats (primarily for unit tests and session baselines). */
export function resetReadCacheStats(): void {
  stats.t0Hits = 0
  stats.t1Hits = 0
  stats.misses = 0
  stats.errors = 0
  stats.lastT0Ms = null
  stats.lastT1Ms = null
}

// In DEV only, attach to window.__hisaabCacheStats for devtools console inspection
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __hisaabCacheStats?: typeof readCacheStats }).__hisaabCacheStats =
    readCacheStats
}

function compoundKey(scope: string, key: string): string {
  return `${scope}::${key}`
}

const memoryStore = new Map<string, ReadCacheEntry>()

/**
 * Synchronous T0 lookup (< 1 ms). Checks the in-memory tier only.
 * Returns null on miss, schemaVersion mismatch, or when kill-switch is active.
 */
export function readCachedSync<T>(scope: string, key: string, schemaVersion: number): T | null {
  if (DISABLED) {
    return null
  }

  const t0Start = performance.now()
  const cKey = compoundKey(scope, key)
  const entry = memoryStore.get(cKey)

  if (!entry) {
    stats.lastT0Ms = performance.now() - t0Start
    return null
  }

  if (entry.schemaVersion !== schemaVersion) {
    memoryStore.delete(cKey)
    stats.lastT0Ms = performance.now() - t0Start
    return null
  }

  stats.t0Hits++
  stats.lastT0Ms = performance.now() - t0Start
  return entry.value as T
}

/**
 * Full T0 -> T1 read lookup.
 * 1. Checks T0 (< 1 ms). On hit, returns immediately without touching IndexedDB.
 * 2. Checks T1 Dexie (< 5 ms). On hit, backfills T0 and returns.
 * 3. On schemaVersion mismatch, evicts the stale record and returns null.
 * 4. On any storage error, gracefully returns null (best-effort).
 */
export async function readCached<T>(
  scope: string,
  key: string,
  schemaVersion: number,
): Promise<T | null> {
  if (DISABLED) {
    stats.misses++
    return null
  }

  const syncHit = readCachedSync<T>(scope, key, schemaVersion)
  if (syncHit !== null) {
    return syncHit
  }

  const t1Start = performance.now()
  try {
    const entry = await db.readCache.get([scope, key])
    stats.lastT1Ms = performance.now() - t1Start

    if (!entry) {
      stats.misses++
      return null
    }
    if (entry.schemaVersion !== schemaVersion) {
      stats.misses++
      void db.readCache.delete([scope, key]).catch(() => undefined)
      return null
    }

    // Backfill T0 so subsequent reads in the current tab are instant
    stats.t1Hits++
    memoryStore.set(compoundKey(scope, key), entry)
    return entry.value as T
  } catch {
    stats.errors++
    stats.misses++
    stats.lastT1Ms = performance.now() - t1Start
    return null
  }
}

/**
 * Writes payload to both T0 memory and T1 Dexie tiers.
 * T0 is updated synchronously; T1 is persisted asynchronously.
 */
export async function writeCached<T>(
  scope: string,
  key: string,
  value: T,
  schemaVersion: number,
): Promise<void> {
  if (DISABLED) {
    return
  }

  const entry: ReadCacheEntry = {
    scope,
    key,
    value,
    fetchedAt: Date.now(),
    schemaVersion,
  }

  memoryStore.set(compoundKey(scope, key), entry)

  try {
    await db.readCache.put(entry)
  } catch {
    stats.errors++
  }
}

/**
 * Evicts all cached entries matching the given scope from both T0 and T1.
 * Called on business switch and account changes.
 */
export async function evictScope(scope: string): Promise<void> {
  if (DISABLED) {
    return
  }

  for (const [cKey, entry] of memoryStore.entries()) {
    if (entry.scope === scope) {
      memoryStore.delete(cKey)
    }
  }

  try {
    await db.readCache.where('scope').equals(scope).delete()
  } catch {
    // Best-effort
  }
}

/**
 * Scoped T0 pre-warming from Dexie T1.
 * Hydrates entries for the specified scopes from IndexedDB into memoryStore in < 5ms.
 */
export async function warmReadCache(scopes?: string[]): Promise<void> {
  if (DISABLED) {
    return
  }

  const t1Start = performance.now()
  try {
    let entries: ReadCacheEntry[]
    if (scopes && scopes.length > 0) {
      entries = await db.readCache.where('scope').anyOf(scopes).toArray()
    } else {
      entries = await db.readCache.toArray()
    }

    for (const entry of entries) {
      if (entry && entry.scope && entry.key) {
        memoryStore.set(compoundKey(entry.scope, entry.key), entry)
      }
    }
    stats.lastT1Ms = performance.now() - t1Start
  } catch {
    stats.errors++
  }
}

/**
 * Clears the entire read cache across all scopes in both T0 and T1.
 * Called on auth logout.
 */
export async function clearReadCache(): Promise<void> {
  if (DISABLED) {
    return
  }

  memoryStore.clear()
  try {
    await db.readCache.clear()
  } catch {
    // Best-effort
  }
}
