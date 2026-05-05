/**
 * In-memory cache with TTL — lightweight Redis substitute for dev.
 * In production, swap the Map for a Redis client in getOrCompute().
 * Keys expire lazily on next access or on explicit invalidate().
 */

import logger from './logger.js'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

/** Retrieve a cached value, or undefined if missing/expired. */
export function get<T>(key: string): T | undefined {
  const entry = store.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return undefined
  }
  return entry.value as T
}

/** Write a value with TTL in seconds. */
export function set<T>(key: string, value: T, ttlSeconds: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}

/** Remove a cache key immediately. */
export function invalidate(key: string): void {
  store.delete(key)
  logger.debug('Cache invalidated', { key })
}

/** Remove all keys that start with prefix. */
export function invalidatePrefix(prefix: string): void {
  let count = 0
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key)
      count++
    }
  }
  logger.debug('Cache prefix invalidated', { prefix, count })
}

/**
 * Read-through helper. If key is cached and not expired, returns cached value.
 * Otherwise calls computer(), caches the result with ttlSeconds, and returns it.
 *
 * Usage:
 *   const result = await getOrCompute('aging:biz123', 300, () => computeAgingBuckets(bizId, now))
 */
export async function getOrCompute<T>(
  key: string,
  ttlSeconds: number,
  computer: () => Promise<T>
): Promise<T> {
  const cached = get<T>(key)
  if (cached !== undefined) {
    logger.debug('Cache hit', { key })
    return cached
  }
  logger.debug('Cache miss — computing', { key })
  const value = await computer()
  set(key, value, ttlSeconds)
  return value
}
