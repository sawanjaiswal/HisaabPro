/**
 * In-memory token blacklist with auto-cleanup.
 * Adapted from HisaabPro's tokenBlacklist.ts.
 * Tokens are blacklisted on logout and auto-removed after expiry.
 *
 * LIMITATION: In-memory only — blacklisted tokens are lost on server restart
 * and not shared across multiple instances. For multi-instance deployments,
 * replace with Redis: set REDIS_URL env var and use the RedisStore from
 * rate-limit.ts as a pattern. Short JWT expiry (15min) mitigates the risk.
 */

const blacklistedTokens = new Map<string, number>() // token → expiresAt (ms)
const blacklistedUsers = new Set<string>() // userId — for account deletion/suspension

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
const MAX_BLACKLISTED_TOKENS = 10_000 // prevent unbounded memory growth
const MAX_BLACKLISTED_USERS = 5_000

/** Blacklist a token until it naturally expires */
export function blacklistToken(token: string, ttlMs: number): void {
  if (ttlMs <= 0) return
  // Evict oldest entries if at capacity (FIFO — first key in Map is oldest)
  if (blacklistedTokens.size >= MAX_BLACKLISTED_TOKENS) {
    const firstKey = blacklistedTokens.keys().next().value
    if (firstKey !== undefined) blacklistedTokens.delete(firstKey)
  }
  blacklistedTokens.set(token, Date.now() + ttlMs)
}

/** Check if a token is blacklisted */
export function isBlacklisted(token: string): boolean {
  const expiresAt = blacklistedTokens.get(token)
  if (expiresAt === undefined) return false
  if (Date.now() > expiresAt) {
    blacklistedTokens.delete(token)
    return false
  }
  return true
}

/** Blacklist all tokens for a user (account deletion/suspension) */
export function blacklistUser(userId: string): void {
  // Evict oldest if at capacity
  if (blacklistedUsers.size >= MAX_BLACKLISTED_USERS) {
    const firstKey = blacklistedUsers.values().next().value
    if (firstKey !== undefined) blacklistedUsers.delete(firstKey)
  }
  blacklistedUsers.add(userId)
}

/** Check if a user's tokens are all blacklisted */
export function isUserBlacklisted(userId: string): boolean {
  return blacklistedUsers.has(userId)
}

/** Remove expired tokens from the blacklist */
function cleanup(): void {
  const now = Date.now()
  for (const [token, expiresAt] of blacklistedTokens) {
    if (now > expiresAt) {
      blacklistedTokens.delete(token)
    }
  }
}

// Auto-cleanup every hour
setInterval(cleanup, CLEANUP_INTERVAL_MS).unref()
