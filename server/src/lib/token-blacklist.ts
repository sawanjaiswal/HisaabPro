/**
 * In-memory token blacklist with auto-cleanup.
 * Adapted from DudhHisaab's tokenBlacklist.ts.
 * Tokens are blacklisted on logout and auto-removed after expiry.
 */

const blacklistedTokens = new Map<string, number>() // token → expiresAt (ms)
const blacklistedUsers = new Set<string>() // userId — for account deletion/suspension

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

/** Blacklist a token until it naturally expires */
export function blacklistToken(token: string, ttlMs: number): void {
  if (ttlMs <= 0) return
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
