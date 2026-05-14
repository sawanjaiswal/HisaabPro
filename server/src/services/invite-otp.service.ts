/**
 * invite-otp.service.ts — OTP gate for the invite-claim existing-user branch.
 *
 * Security F2 (SECURITY_AUDIT §F2): existing-user claim REQUIRES a fresh OTP
 * to the party's registered phone.  This service wraps the existing OtpCode
 * infrastructure and mints a short-lived signed nonce on successful verify.
 *
 * The OTP session is bound to BOTH the phone AND the link's tokenHash so a
 * valid OTP for one invite cannot be replayed against a different invite link.
 *
 * This service DOES NOT modify auth.service.ts contracts — it calls the same
 * underlying OtpCode table helpers that the auth service uses, scoped to a new
 * context purpose: 'invite-claim'.
 */

import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import {
  generateOTP,
  hashOTP,
  verifyOTP,
  sendOTP,
  OTP_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
} from '../lib/otp.js'
import logger from '../lib/logger.js'

// ---------------------------------------------------------------------------
// OTP verified token — short-lived JWT scoped to this invite link
// ---------------------------------------------------------------------------

const JWT_SECRET = process.env.JWT_SECRET!
const OTP_VERIFIED_TOKEN_TTL = '5m'

interface OtpVerifiedPayload {
  purpose: 'invite-claim'
  tokenHash: string
  phone: string
  iat?: number
  exp?: number
}

/** Mint a short-lived token proving OTP was verified for this link+phone pair. */
function mintOtpVerifiedToken(tokenHash: string, phone: string): string {
  const payload: OtpVerifiedPayload = { purpose: 'invite-claim', tokenHash, phone }
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: OTP_VERIFIED_TOKEN_TTL,
  } as jwt.SignOptions)
}

/** Verify and decode an otpVerifiedToken. Throws on tamper/expiry. */
export function verifyOtpVerifiedToken(
  token: string
): OtpVerifiedPayload {
  const payload = jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
  }) as OtpVerifiedPayload

  if (payload.purpose !== 'invite-claim') {
    throw new Error('Invalid otpVerifiedToken purpose')
  }

  return payload
}

// ---------------------------------------------------------------------------
// sendInviteOtp
// ---------------------------------------------------------------------------

export interface SendInviteOtpResult {
  sent: boolean
  message: string
  /** Seconds until resend is available */
  resendCooldownSec?: number
}

/**
 * Send an OTP to the party's phone number for the invite-claim flow.
 * Stores context: { purpose: 'invite-claim', tokenHash } so the OtpCode row
 * is scoped to this specific link — a code from a different link can't be used.
 */
export async function sendInviteOtp(params: {
  phone: string
  tokenHash: string
}): Promise<SendInviteOtpResult> {
  const { phone, tokenHash } = params

  // Resend cooldown — check most recent invite-claim OTP for this phone+link
  const recent = await prisma.otpCode.findFirst({
    where: {
      phone,
      verified: false,
      context: { contains: `"tokenHash":"${tokenHash}"` },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (recent) {
    const elapsed = Date.now() - recent.createdAt.getTime()
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
      return {
        sent: false,
        message: `Please wait ${waitSec}s before requesting a new OTP`,
        resendCooldownSec: waitSec,
      }
    }
  }

  const otp = generateOTP()
  const otpHash = await hashOTP(otp)

  await prisma.otpCode.create({
    data: {
      phone,
      code: otpHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      // Context ties this OTP record to the specific invite link
      context: JSON.stringify({ purpose: 'invite-claim', tokenHash }),
    },
  })

  const sent = await sendOTP(phone, otp)

  if (!sent && process.env.NODE_ENV === 'production') {
    logger.warn('invite-otp: SMS send failed', { phone: phone.slice(-4) })
    return { sent: false, message: 'Failed to send OTP. Please try again.' }
  }

  return { sent: true, message: `OTP sent to ${maskPhone(phone)}` }
}

// ---------------------------------------------------------------------------
// verifyInviteOtp
// ---------------------------------------------------------------------------

export interface VerifyInviteOtpResult {
  verified: boolean
  message: string
  /** Present only when verified === true */
  otpVerifiedToken?: string
}

/**
 * Verify the 6-digit code against the pending invite-claim OTP.
 * On success, mints a short-lived otpVerifiedToken (5-min JWT) binding
 * the phone + tokenHash together.  Claim handler must validate this token
 * before running the atomic claim transaction.
 */
export async function verifyInviteOtp(params: {
  phone: string
  code: string
  tokenHash: string
}): Promise<VerifyInviteOtpResult> {
  const { phone, code, tokenHash } = params

  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      phone,
      verified: false,
      context: { contains: `"tokenHash":"${tokenHash}"` },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!otpRecord) {
    return { verified: false, message: 'No OTP found. Please request a new one.' }
  }

  // Expiry check
  if (new Date() > otpRecord.expiresAt) {
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    })
    return { verified: false, message: 'OTP expired. Please request a new one.' }
  }

  // Max attempts lockout
  if (otpRecord.attempts >= MAX_ATTEMPTS) {
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    })
    return { verified: false, message: 'Too many failed attempts. Please request a new OTP.' }
  }

  // Constant-time comparison (bcrypt.compare)
  if (!(await verifyOTP(otpRecord.code, code))) {
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    })
    const remaining = MAX_ATTEMPTS - otpRecord.attempts - 1
    return { verified: false, message: `Invalid OTP. ${remaining} attempts remaining.` }
  }

  // Mark consumed — single-use
  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { verified: true },
  })

  const otpVerifiedToken = mintOtpVerifiedToken(tokenHash, phone)

  return {
    verified: true,
    message: 'OTP verified',
    otpVerifiedToken,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '****'
  return `****${digits.slice(-4)}`
}

/** SHA-256 of the plaintext token — mirrors resolve-public-token.ts */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}
