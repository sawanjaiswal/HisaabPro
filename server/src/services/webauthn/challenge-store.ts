/**
 * WebAuthn Challenge Store — in-memory, 5-minute TTL, one-time use.
 */

import crypto from 'crypto'

interface ChallengeEntry {
  challenge: string
  userId?: string
  createdAt: number
}

const challengeStore = new Map<string, ChallengeEntry>()
const CHALLENGE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// Auto-cleanup stale challenges every minute (unref so it doesn't block process exit)
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of challengeStore) {
    if (now - entry.createdAt > CHALLENGE_TTL_MS) {
      challengeStore.delete(key)
    }
  }
}, 60_000).unref()

/** Generate a cryptographically random challenge (base64url-encoded 32 bytes). */
export function generateChallenge(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/** Store a challenge with optional userId association. */
export function storeChallenge(key: string, challenge: string, userId?: string): void {
  challengeStore.set(key, { challenge, userId, createdAt: Date.now() })
  setTimeout(() => challengeStore.delete(key), CHALLENGE_TTL_MS)
}

/** Verify + consume a challenge (one-time use). Returns null if missing or expired. */
export function consumeChallenge(key: string): { challenge: string; userId?: string } | null {
  const entry = challengeStore.get(key)
  if (!entry) return null

  if (Date.now() - entry.createdAt > CHALLENGE_TTL_MS) {
    challengeStore.delete(key)
    return null
  }

  challengeStore.delete(key) // one-time use
  return { challenge: entry.challenge, userId: entry.userId }
}
