/**
 * Public-booking HMAC signature service.
 *
 * Per architecture §5 + security audit:
 *   Canonical payload: `${businessId}|${employeeId ?? ''}|${expiresAt.toISOString()}`
 *   Algorithm:         HMAC-SHA256 over the canonical bytes using
 *                      Business.publicBookingHmacSecret (32 random bytes).
 *   Encoding:          base64url(payload).base64url(sig)
 *   Verify order:      ALWAYS load the business secret and check revokedAt
 *                      BEFORE computing the HMAC (we still verify the HMAC
 *                      after — never short-circuit out — but we abort if the
 *                      business is missing or the SharedLink is revoked).
 *   Compare:           `crypto.timingSafeEqual` — no early-return on byte mismatch.
 *   Clamp:             expiresAt may not be more than PUBLIC_BOOKING_HMAC_MAX_DAYS
 *                      from "now"; signing rejects out-of-range timestamps.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { AppError, ErrorCode } from '../lib/errors.js'
import {
  PUBLIC_BOOKING_CANONICAL_SEP,
  PUBLIC_BOOKING_HMAC_MAX_DAYS,
  APPT_ERR,
} from '../constants/appointment.constants.js'
import type { PublicBookingPayload, PublicBookingSignedLink } from '../types/appointment.types.js'

const MAX_DAYS_MS = PUBLIC_BOOKING_HMAC_MAX_DAYS * 24 * 60 * 60 * 1000

export function canonicalPayload(payload: PublicBookingPayload): string {
  return [
    payload.businessId,
    payload.employeeId ?? '',
    payload.expiresAt.toISOString(),
  ].join(PUBLIC_BOOKING_CANONICAL_SEP)
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

/** Compute HMAC-SHA256 hex digest of the canonical payload. */
function computeHmac(secret: Buffer, canonical: string): Buffer {
  return createHmac('sha256', secret).update(canonical).digest()
}

/** Generate a fresh 32-byte secret for a business. */
export function generatePublicBookingSecret(): Buffer {
  return randomBytes(32)
}

/**
 * Sign a payload using the business's stored secret.
 * Throws if `expiresAt` is out of range or business secret missing.
 */
export async function signPublicBookingLink(
  payload: PublicBookingPayload
): Promise<PublicBookingSignedLink> {
  const now = Date.now()
  const exp = payload.expiresAt.getTime()
  if (exp <= now || exp - now > MAX_DAYS_MS) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      400,
      `expiresAt must be within ${PUBLIC_BOOKING_HMAC_MAX_DAYS} days`
    )
  }

  const business = await prisma.business.findUnique({
    where: { id: payload.businessId },
    select: { publicBookingHmacSecret: true },
  })
  if (!business?.publicBookingHmacSecret) {
    throw new AppError(ErrorCode.NOT_FOUND, 404, 'Public booking secret not configured')
  }
  const secret = Buffer.from(business.publicBookingHmacSecret)

  const canonical = canonicalPayload(payload)
  const sig = computeHmac(secret, canonical)
  const token = `${b64urlEncode(Buffer.from(canonical))}.${b64urlEncode(sig)}`
  return { token, expiresAt: payload.expiresAt }
}

export interface VerifyResult {
  payload: PublicBookingPayload
}

/**
 * Verify a public-booking token.
 *
 * Order (do NOT reorder):
 *   1. Parse token into (payload, sig)
 *   2. Load business + check secret exists
 *   3. (caller may also check SharedLink.revokedAt BEFORE this if applicable)
 *   4. timingSafeEqual HMAC compare
 *   5. expiresAt > now check
 */
export async function verifyPublicBookingToken(token: string): Promise<VerifyResult> {
  const parts = token.split('.')
  if (parts.length !== 2) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'Invalid token', {
      code: APPT_ERR.PUBLIC_BOOKING_INVALID,
    })
  }
  let canonical: string
  let sig: Buffer
  try {
    canonical = b64urlDecode(parts[0]!).toString('utf8')
    sig = b64urlDecode(parts[1]!)
  } catch {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'Invalid token', {
      code: APPT_ERR.PUBLIC_BOOKING_INVALID,
    })
  }

  const segs = canonical.split(PUBLIC_BOOKING_CANONICAL_SEP)
  if (segs.length !== 3) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'Invalid token', {
      code: APPT_ERR.PUBLIC_BOOKING_INVALID,
    })
  }
  const [businessId, employeeIdRaw, expiresAtIso] = segs as [string, string, string]
  const expiresAt = new Date(expiresAtIso)
  if (Number.isNaN(expiresAt.getTime())) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'Invalid token', {
      code: APPT_ERR.PUBLIC_BOOKING_INVALID,
    })
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { publicBookingHmacSecret: true },
  })
  if (!business?.publicBookingHmacSecret) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'Invalid token', {
      code: APPT_ERR.PUBLIC_BOOKING_INVALID,
    })
  }
  const secret = Buffer.from(business.publicBookingHmacSecret)

  const expected = computeHmac(secret, canonical)
  // Lengths MUST match before timingSafeEqual or it throws.
  const sigEqualsLen = sig.length === expected.length
  // Always run timingSafeEqual on equal-length buffers (pad sig if not) to
  // avoid timing leak between "wrong length" and "right length wrong bytes".
  const safeSig = sigEqualsLen ? sig : Buffer.alloc(expected.length)
  const sigOk = sigEqualsLen && timingSafeEqual(safeSig, expected)
  if (!sigOk) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'Invalid token', {
      code: APPT_ERR.PUBLIC_BOOKING_INVALID,
    })
  }

  if (expiresAt.getTime() <= Date.now()) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'Expired token', {
      code: APPT_ERR.PUBLIC_BOOKING_EXPIRED,
    })
  }

  return {
    payload: {
      businessId,
      employeeId: employeeIdRaw === '' ? null : employeeIdRaw,
      expiresAt,
    },
  }
}
