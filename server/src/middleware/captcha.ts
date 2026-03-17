import type { Request, Response, NextFunction } from 'express'
import logger from '../lib/logger.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of failed login attempts before CAPTCHA is required */
export const CAPTCHA_THRESHOLD = 3

/** Window in which failed attempts are counted (ms) — 15 minutes */
const CAPTCHA_WINDOW_MS = 15 * 60 * 1000

/** Cloudflare Turnstile verification endpoint */
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

// ---------------------------------------------------------------------------
// In-memory store for failed attempts (same pattern as MemoryStore in rate-limit.ts)
// ---------------------------------------------------------------------------

interface FailEntry {
  count: number
  resetAt: number
}

const failStore = new Map<string, FailEntry>()

// Evict expired entries every 60 seconds
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of failStore) {
    if (now > entry.resetAt) failStore.delete(key)
  }
}, 60_000).unref()

/** Record a failed login attempt for the given IP. */
export function recordFailedAttempt(ip: string): void {
  const now = Date.now()
  const existing = failStore.get(ip)

  if (!existing || now > existing.resetAt) {
    failStore.set(ip, { count: 1, resetAt: now + CAPTCHA_WINDOW_MS })
    return
  }

  existing.count++
}

/** Return how many failed attempts have been recorded for this IP. */
function getFailCount(ip: string): number {
  const now = Date.now()
  const entry = failStore.get(ip)
  if (!entry || now > entry.resetAt) return 0
  return entry.count
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * captchaGuard — attach before login routes.
 *
 * - If TURNSTILE_SECRET_KEY is not set, skips CAPTCHA entirely (dev mode).
 * - If the IP has fewer than CAPTCHA_THRESHOLD failures, passes through.
 * - Otherwise, requires a valid captchaToken in req.body.
 */
export async function captchaGuard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY

  // Dev mode — skip CAPTCHA when no secret is configured
  if (!secret) {
    next()
    return
  }

  const ip = req.ip ?? 'unknown'
  const failCount = getFailCount(ip)

  if (failCount < CAPTCHA_THRESHOLD) {
    next()
    return
  }

  // CAPTCHA required — validate the token from request body
  const { captchaToken } = req.body as { captchaToken?: string }

  if (!captchaToken) {
    res.status(400).json({
      success: false,
      captchaRequired: true,
      error: { code: 'CAPTCHA_REQUIRED', message: 'Please complete the CAPTCHA to continue.' },
    })
    return
  }

  try {
    const verifyRes = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: captchaToken, remoteip: ip }),
    })

    const data = (await verifyRes.json()) as { success: boolean }

    if (!data.success) {
      logger.warn('captcha.verification_failed', { ip })
      res.status(400).json({
        success: false,
        captchaRequired: true,
        error: { code: 'CAPTCHA_INVALID', message: 'CAPTCHA verification failed. Please try again.' },
      })
      return
    }
  } catch (err) {
    logger.error('captcha.verify_error', { ip, err })
    // On network error, fail open — don't block legitimate users
    next()
    return
  }

  next()
}
