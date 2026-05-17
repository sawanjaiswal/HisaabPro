/**
 * pin-grace-cookie unit tests — v2.3 A02.2 + Q1 + Q2 coverage.
 *
 * Covers: valid round-trip · tampered HMAC · expired exp · expired iat (per-class
 * freshness) · cross-user reject · cross-tenant reject · class mismatch · pf
 * mismatch after PIN change · missing parts / malformed · domain-prefix mismatch
 * (Q1 — payload signed without DOMAIN_PREFIX must be rejected) · security_event
 * emissions for each fail mode (Q2 — alert rule wiring).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  buildGraceCookie,
  verifyPinGraceCookie,
  computePinFingerprint,
  HARD_CAP_SECONDS,
  ROUTE_CLASS_WINDOW_SECONDS,
} from './pin-grace-cookie.js'
import { SECURITY_EVENT } from '../../lib/security-events.js'
import logger from '../../lib/logger.js'

// Mock logger so we can inspect security_event emissions. Winston's `warn`
// signature accepts (msg, ...meta) — vi.fn() lets us read .mock.calls as a
// typed tuple in eventsEmitted() below.
vi.mock('../../lib/logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const USER_A = 'user-a'
const USER_B = 'user-b'
const BIZ_A = 'biz-a'
const BIZ_B = 'biz-b'
const PIN_HASH_A = 'pinhash-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const PIN_HASH_B = 'pinhash-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

const warnSpy = logger.warn as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  warnSpy.mockClear()
})

function eventsEmitted(): string[] {
  return (warnSpy.mock.calls as Array<[string, { event: string }?]>)
    .filter((call) => call[0] === 'security_event')
    .map((call) => (call[1] as { event: string }).event)
}

describe('pin-grace-cookie — happy path', () => {
  it('round-trip: valid cookie passes verify with matching uid/bid/rc/pinHash', () => {
    const cookie = buildGraceCookie(USER_A, BIZ_A, 'mutation', PIN_HASH_A)
    const result = verifyPinGraceCookie(cookie, USER_A, BIZ_A, 'mutation', PIN_HASH_A)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.uid).toBe(USER_A)
      expect(result.payload.bid).toBe(BIZ_A)
      expect(result.payload.rc).toBe('mutation')
      expect(result.payload.pf).toBe(computePinFingerprint(PIN_HASH_A))
      expect(result.payload.exp - result.payload.iat).toBe(HARD_CAP_SECONDS)
    }
  })

  it('read-only class has its own freshness window (60min)', () => {
    const nowSec = 1_700_000_000
    const cookie = buildGraceCookie(USER_A, BIZ_A, 'read-only', PIN_HASH_A, nowSec)
    // 30 min later — still inside the 60-min read-only window
    const later = nowSec + 30 * 60
    const result = verifyPinGraceCookie(cookie, USER_A, BIZ_A, 'read-only', PIN_HASH_A, later)
    expect(result.ok).toBe(true)
  })
})

describe('pin-grace-cookie — tamper + replay defenses', () => {
  it('rejects tampered HMAC and emits hmac_mismatch + cookie_tamper_detected', () => {
    const cookie = buildGraceCookie(USER_A, BIZ_A, 'mutation', PIN_HASH_A)
    const [payload] = cookie.split('.')
    const forged = `${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`
    const result = verifyPinGraceCookie(forged, USER_A, BIZ_A, 'mutation', PIN_HASH_A)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('hmac_mismatch')
    const events = eventsEmitted()
    expect(events).toContain(SECURITY_EVENT.PIN_GATE_HMAC_MISMATCH)
    expect(events).toContain(SECURITY_EVENT.PIN_GATE_COOKIE_TAMPER_DETECTED)
  })

  it('Q1 domain-separation: payload signed WITHOUT prefix is rejected as hmac_mismatch', () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const payload = {
      uid: USER_A, bid: BIZ_A, rc: 'mutation', iat: nowSec,
      exp: nowSec + HARD_CAP_SECONDS, pf: computePinFingerprint(PIN_HASH_A),
    }
    const payloadJson = JSON.stringify(payload)
    const encoded = Buffer.from(payloadJson, 'utf8').toString('base64')
      .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
    // Sign WITHOUT the 'pin-grace-cookie-v1:' prefix (simulates JWT-style replay)
    const badSig = createHmac('sha256', process.env.JWT_SECRET!).update(payloadJson).digest('base64')
      .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
    const forged = `${encoded}.${badSig}`
    const result = verifyPinGraceCookie(forged, USER_A, BIZ_A, 'mutation', PIN_HASH_A)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('hmac_mismatch')
    expect(eventsEmitted()).toContain(SECURITY_EVENT.PIN_GATE_HMAC_MISMATCH)
  })

  it('rejects cross-user replay (cookie uid differs from session userId)', () => {
    const cookie = buildGraceCookie(USER_A, BIZ_A, 'mutation', PIN_HASH_A)
    const result = verifyPinGraceCookie(cookie, USER_B, BIZ_A, 'mutation', PIN_HASH_A)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('cross_user')
    const events = eventsEmitted()
    expect(events).toContain(SECURITY_EVENT.PIN_GATE_CROSS_USER)
    expect(events).toContain(SECURITY_EVENT.PIN_GATE_COOKIE_TAMPER_DETECTED)
  })

  it('rejects cross-tenant replay (cookie bid differs from active businessId)', () => {
    const cookie = buildGraceCookie(USER_A, BIZ_A, 'mutation', PIN_HASH_A)
    const result = verifyPinGraceCookie(cookie, USER_A, BIZ_B, 'mutation', PIN_HASH_A)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('cross_tenant')
    expect(eventsEmitted()).toContain(SECURITY_EVENT.PIN_GATE_CROSS_TENANT)
  })

  it('rejects when expectedClass != cookie.rc (per-class grace isolation)', () => {
    const cookie = buildGraceCookie(USER_A, BIZ_A, 'mutation', PIN_HASH_A)
    const result = verifyPinGraceCookie(cookie, USER_A, BIZ_A, 'read-only', PIN_HASH_A)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('class_mismatch')
  })
})

describe('pin-grace-cookie — temporal + invalidation', () => {
  it('rejects when iat is older than the route-class window', () => {
    const nowSec = 1_700_000_000
    const cookie = buildGraceCookie(USER_A, BIZ_A, 'mutation', PIN_HASH_A, nowSec)
    // 6 min later — past 5 min mutation window
    const later = nowSec + ROUTE_CLASS_WINDOW_SECONDS.mutation + 60
    const result = verifyPinGraceCookie(cookie, USER_A, BIZ_A, 'mutation', PIN_HASH_A, later)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('iat_too_old')
  })

  it('rejects when exp is past (12h hard cap, server-enforced)', () => {
    const nowSec = 1_700_000_000
    const cookie = buildGraceCookie(USER_A, BIZ_A, 'mutation', PIN_HASH_A, nowSec)
    // 13h later — past hard cap (iat check would also fire; expired wins by order)
    const later = nowSec + HARD_CAP_SECONDS + 60
    const result = verifyPinGraceCookie(cookie, USER_A, BIZ_A, 'mutation', PIN_HASH_A, later)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('expired')
  })

  it('A02.2: pf mismatch after PIN rotation rejects as pin_rotated', () => {
    const cookie = buildGraceCookie(USER_A, BIZ_A, 'mutation', PIN_HASH_A)
    // Simulate PIN change — DB now has PIN_HASH_B
    const result = verifyPinGraceCookie(cookie, USER_A, BIZ_A, 'mutation', PIN_HASH_B)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('pin_rotated')
    // pf_stale is benign — emitted but NOT aggregated into cookie_tamper_detected
    const events = eventsEmitted()
    expect(events).toContain(SECURITY_EVENT.PIN_GATE_PF_STALE)
    expect(events).not.toContain(SECURITY_EVENT.PIN_GATE_COOKIE_TAMPER_DETECTED)
  })
})

describe('pin-grace-cookie — malformed input', () => {
  it('rejects undefined cookie as missing', () => {
    const result = verifyPinGraceCookie(undefined, USER_A, BIZ_A, 'mutation', PIN_HASH_A)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing')
  })

  it('rejects empty string as missing', () => {
    const result = verifyPinGraceCookie('', USER_A, BIZ_A, 'mutation', PIN_HASH_A)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing')
  })

  it('rejects cookie missing the dot separator as malformed', () => {
    const result = verifyPinGraceCookie('nodothere', USER_A, BIZ_A, 'mutation', PIN_HASH_A)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('malformed')
  })

  it('rejects cookie with empty payload half as malformed', () => {
    const result = verifyPinGraceCookie('.sig', USER_A, BIZ_A, 'mutation', PIN_HASH_A)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('malformed')
  })

  it('rejects cookie whose payload is not valid base64 JSON as malformed', () => {
    const result = verifyPinGraceCookie('!!!notbase64!!!.sig', USER_A, BIZ_A, 'mutation', PIN_HASH_A)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(['malformed', 'hmac_mismatch']).toContain(result.reason)
  })
})

describe('computePinFingerprint', () => {
  it('returns deterministic 12-hex char string', () => {
    const fp = computePinFingerprint(PIN_HASH_A)
    expect(fp).toHaveLength(12)
    expect(fp).toMatch(/^[0-9a-f]{12}$/)
    expect(fp).toBe(computePinFingerprint(PIN_HASH_A))
  })

  it('produces different fp for different pinHash (A02.2 invalidation contract)', () => {
    expect(computePinFingerprint(PIN_HASH_A)).not.toBe(computePinFingerprint(PIN_HASH_B))
  })
})
