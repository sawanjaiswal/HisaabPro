/**
 * PIN grace cookie — HMAC-signed, httpOnly, SameSite=strict (v2.3 A02.2 + Q1 + Q3).
 *
 * Stores PIN-verify grace state in a single cookie instead of a server-side
 * session table. The cookie binds to:
 *
 *   - userId            (cross-user replay defense)
 *   - businessId        (cross-tenant replay defense)
 *   - routeClass        (mutation grace ≠ read-only grace)
 *   - issued-at + 12h hard cap, server-enforced
 *   - pf (pin fingerprint = sha256(pinHash).slice(0,12))   ← A02.2 invalidation
 *
 * On PIN change/reset, `pinHash` rotates → every prior cookie's `pf` becomes
 * stale → cookies silently 403 with `pin_rotated` on next gated request. No
 * server-side session-table sweep needed.
 *
 * HMAC input is prefixed with the literal `'pin-grace-cookie-v1:'` (Q1 domain
 * separation) so a JWT_SECRET-signed payload from another surface cannot be
 * replayed as a pin-grace cookie even if bytes happen to match.
 *
 * Cookie attributes (set by issuePinGraceCookie):
 *   httpOnly · secure (prod) · sameSite=strict · path=/api · maxAge=43200s (12h)
 *
 * sameSite=strict (Q3) — fail-mode for future OAuth callback is intentional:
 * a fresh requireRecentPin re-verify on the post-callback route is the
 * correct security default. Do NOT relax to lax.
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §5.3 + §10.5 + SECURITY_AUDIT A02.2/Q1/Q3.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import { SECURITY_EVENT, emitSecurityEvent } from '../../lib/security-events.js'

export const COOKIE_NAME = 'pin_gate_grace'
export const COOKIE_PATH = '/api'
const DOMAIN_PREFIX = 'pin-grace-cookie-v1:'
/** 12h hard envelope — server-side enforced via payload.exp regardless of browser maxAge. */
export const HARD_CAP_SECONDS = 12 * 60 * 60
/** Per-class freshness window — see §5.3 (mutation 5min, read-only 60min). */
export const ROUTE_CLASS_WINDOW_SECONDS = {
  mutation: 5 * 60,
  'read-only': 60 * 60,
} as const

export type RouteClass = keyof typeof ROUTE_CLASS_WINDOW_SECONDS

export interface GracePayload {
  uid: string
  bid: string
  rc: RouteClass
  iat: number
  exp: number
  pf: string
}

export type VerifyFailReason =
  | 'missing'
  | 'malformed'
  | 'hmac_mismatch'
  | 'cross_user'
  | 'cross_tenant'
  | 'class_mismatch'
  | 'expired'
  | 'iat_too_old'
  | 'pin_rotated'

export type VerifyResult =
  | { ok: true; payload: GracePayload }
  | { ok: false; reason: VerifyFailReason }

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be set and at least 32 characters for pin-grace-cookie HMAC')
  }
  return secret
}

/** sha256(pinHash) → first 12 hex chars. 48 bits of binding; stale-pf detection. */
export function computePinFingerprint(pinHash: string): string {
  return createHash('sha256').update(pinHash).digest('hex').slice(0, 12)
}

function base64urlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function base64urlDecode(input: string): Buffer {
  const padding = (4 - (input.length % 4)) % 4
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padding)
  return Buffer.from(padded, 'base64')
}

function sign(payloadJson: string): string {
  return createHmac('sha256', getSecret()).update(DOMAIN_PREFIX + payloadJson).digest('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * Mint a fresh grace cookie payload (does NOT call res.cookie — pure builder).
 * The route handler typically wraps this in `issuePinGraceCookie(res, ...)`.
 */
export function buildGraceCookie(
  userId: string,
  businessId: string,
  routeClass: RouteClass,
  pinHash: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): string {
  const payload: GracePayload = {
    uid: userId,
    bid: businessId,
    rc: routeClass,
    iat: nowSec,
    exp: nowSec + HARD_CAP_SECONDS,
    pf: computePinFingerprint(pinHash),
  }
  const payloadJson = JSON.stringify(payload)
  const encodedPayload = base64urlEncode(payloadJson)
  const sig = sign(payloadJson)
  return `${encodedPayload}.${sig}`
}

/**
 * Issue cookie on res — convenience wrapper. Call after successful PIN verify.
 */
export function issuePinGraceCookie(
  res: Response,
  userId: string,
  businessId: string,
  routeClass: RouteClass,
  pinHash: string,
): void {
  const value = buildGraceCookie(userId, businessId, routeClass, pinHash)
  res.cookie(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: COOKIE_PATH,
    maxAge: HARD_CAP_SECONDS * 1000,
  })
}

/** Clear cookie — used by logout / suspend / switch-business. */
export function clearPinGraceCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: COOKIE_PATH })
}

/**
 * Verify the cookie value end-to-end.
 *
 * Emits security-events on tamper / cross-user / cross-tenant / HMAC fail.
 * `pf` mismatch is logged as benign `pin_gate.pf_stale` (not aggregated into
 * cookie_tamper_detected — legitimate PIN rotations trigger this).
 */
export function verifyPinGraceCookie(
  cookieValue: string | undefined,
  expectedUserId: string,
  expectedBusinessId: string,
  expectedClass: RouteClass,
  currentPinHash: string,
  nowSec: number = Math.floor(Date.now() / 1000),
  emitContext: { ip?: string } = {},
): VerifyResult {
  if (!cookieValue) return { ok: false, reason: 'missing' }

  const parts = cookieValue.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: 'malformed' }
  }
  const [encodedPayload, providedSig] = parts

  let payload: GracePayload
  try {
    payload = JSON.parse(base64urlDecode(encodedPayload).toString('utf8'))
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  // HMAC check (constant-time)
  const expectedSig = sign(JSON.stringify(payload))
  const a = Buffer.from(expectedSig)
  const b = Buffer.from(providedSig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    emitSecurityEvent(SECURITY_EVENT.PIN_GATE_HMAC_MISMATCH, { userId: expectedUserId, ip: emitContext.ip })
    return { ok: false, reason: 'hmac_mismatch' }
  }

  if (payload.uid !== expectedUserId) {
    emitSecurityEvent(SECURITY_EVENT.PIN_GATE_CROSS_USER, { userId: expectedUserId, ip: emitContext.ip, reason: `cookie uid=${payload.uid}` })
    return { ok: false, reason: 'cross_user' }
  }
  if (payload.bid !== expectedBusinessId) {
    emitSecurityEvent(SECURITY_EVENT.PIN_GATE_CROSS_TENANT, { userId: expectedUserId, ip: emitContext.ip, reason: `cookie bid=${payload.bid}` })
    return { ok: false, reason: 'cross_tenant' }
  }
  if (payload.rc !== expectedClass) return { ok: false, reason: 'class_mismatch' }
  if (payload.exp < nowSec) return { ok: false, reason: 'expired' }

  const windowSec = ROUTE_CLASS_WINDOW_SECONDS[expectedClass]
  if (nowSec - payload.iat > windowSec) return { ok: false, reason: 'iat_too_old' }

  if (payload.pf !== computePinFingerprint(currentPinHash)) {
    emitSecurityEvent(SECURITY_EVENT.PIN_GATE_PF_STALE, { userId: expectedUserId })
    return { ok: false, reason: 'pin_rotated' }
  }

  return { ok: true, payload }
}

/** Convenience: read the raw cookie value off a request. */
export function readGraceCookie(req: Request): string | undefined {
  return req.cookies?.[COOKIE_NAME]
}
