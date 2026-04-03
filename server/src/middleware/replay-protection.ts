/**
 * Replay Protection Middleware
 * Prevents replay attacks on sensitive mutations by requiring a unique nonce
 * and a fresh timestamp on each request.
 *
 * Client must send:
 *   X-Request-Nonce     — UUID v4 (unique per request)
 *   X-Request-Timestamp — Unix time in milliseconds (Date.now())
 *
 * Requests older than REPLAY_WINDOW_MS or with a previously-seen nonce are
 * rejected with 400. The nonce store is an in-memory Map; swap the store
 * implementation for Redis when horizontal scaling is needed (same pattern
 * as rate-limit.ts).
 */

import type { Request, Response, NextFunction } from 'express'
import logger from '../lib/logger.js'
import {
  REPLAY_WINDOW_MS as _REPLAY_WINDOW_MS,
  REPLAY_CLEANUP_INTERVAL_MS as _CLEANUP_INTERVAL_MS,
} from '../config/security.js'

// ---------------------------------------------------------------------------
// Constants (from config/security.ts SSOT)
// ---------------------------------------------------------------------------

export const REPLAY_WINDOW_MS = _REPLAY_WINDOW_MS
export const CLEANUP_INTERVAL_MS = _CLEANUP_INTERVAL_MS

// ---------------------------------------------------------------------------
// In-memory nonce store
// ---------------------------------------------------------------------------

interface NonceEntry {
  seenAt: number
}

const nonceStore = new Map<string, NonceEntry>()
const MAX_NONCES = 50_000 // prevent unbounded memory growth under traffic spikes

// Evict nonces older than the replay window every CLEANUP_INTERVAL_MS.
// .unref() prevents the interval from keeping the process alive.
setInterval(() => {
  const cutoff = Date.now() - REPLAY_WINDOW_MS
  for (const [nonce, entry] of nonceStore) {
    if (entry.seenAt < cutoff) nonceStore.delete(nonce)
  }
}, CLEANUP_INTERVAL_MS).unref()

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function replayProtection(req: Request, res: Response, next: NextFunction): void {
  const nonce = req.headers['x-request-nonce'] as string | undefined
  const timestampRaw = req.headers['x-request-timestamp'] as string | undefined

  // Both headers are required
  if (!nonce || !timestampRaw) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_REQUEST_HEADERS',
        message: 'X-Request-Nonce and X-Request-Timestamp headers are required.',
      },
    })
    return
  }

  const timestamp = Number(timestampRaw)

  // Timestamp must be a valid number
  if (!Number.isFinite(timestamp)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_TIMESTAMP',
        message: 'X-Request-Timestamp must be a Unix timestamp in milliseconds.',
      },
    })
    return
  }

  // Reject if the request is outside the replay window
  const age = Date.now() - timestamp
  if (age > REPLAY_WINDOW_MS || age < 0) {
    logger.warn('replay_protection.expired', {
      nonce,
      timestamp,
      age,
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.userId,
    })
    res.status(400).json({
      success: false,
      error: {
        code: 'REQUEST_EXPIRED',
        message: 'Request timestamp is outside the allowed window. Ensure your clock is synced and retry.',
      },
    })
    return
  }

  // Reject if nonce was already used
  if (nonceStore.has(nonce)) {
    logger.warn('replay_protection.duplicate', {
      nonce,
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.userId,
    })
    res.status(400).json({
      success: false,
      error: {
        code: 'DUPLICATE_REQUEST',
        message: 'This request has already been processed. Send a new nonce for each request.',
      },
    })
    return
  }

  // Evict oldest nonce if at capacity (FIFO)
  if (nonceStore.size >= MAX_NONCES) {
    const firstKey = nonceStore.keys().next().value
    if (firstKey !== undefined) nonceStore.delete(firstKey)
  }

  // Record the nonce and proceed
  nonceStore.set(nonce, { seenAt: Date.now() })
  next()
}
