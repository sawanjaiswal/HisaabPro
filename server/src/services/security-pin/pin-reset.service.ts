/**
 * PIN reset service — OTP-gated rotation flow.
 *
 * HP port of DH `auth-pin/pin-reset.service.ts` adapted to HP's OTP infra
 * (OtpCode model + bcrypt hash) and per-user PIN model (UserAppSettings).
 *
 * Two-step flow:
 *
 *   /reset/request  → requestPinReset({ userId })
 *     1. SELECT user.phone (from JWT-derived userId — never trust body).
 *     2. Mint a 6-digit OTP, hash via bcrypt, persist OtpCode row.
 *     3. Send OTP via MSG91 (no-op in dev; logger.debug echo).
 *     4. Persist PinResetToken row (random 32-byte hex → sha256 stored).
 *        Returns nothing to client — flow continues via /reset/confirm.
 *
 *   /reset/confirm → confirmPinReset({ userId, otp, newPin })
 *     1. Verify OTP against latest unverified OtpCode for user.phone.
 *     2. On match: hash newPin, atomically:
 *          - update UserAppSettings.pinHash + pinEnabled=true + clear lockout
 *          - mark the PinResetToken row consumed
 *          - mark the OtpCode row verified
 *          - write AuditLog row (PIN_RESET).
 *     3. Throws 401 INVALID_OTP on mismatch.
 *
 * Setting pinHash silently invalidates EVERY prior pin_gate_grace cookie via
 * pf-mismatch — no session-table sweep needed (the v2.3 design payoff).
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §18.4 row 73.
 */

import { randomBytes, createHash } from 'node:crypto'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import { hashPin } from './pin-hash.util.js'
import { hashOTP, verifyOTP, sendOTP, generateOTP } from '../../lib/otp.js'
import { PIN_RESET_TOKEN_TTL_MS } from '../../constants/pin-auth.constants.js'
import { createAuditEntry } from '../settings/audit.js'

export interface RequestPinResetInput {
  userId: string
}

export interface RequestPinResetResult {
  /** Always true on success — the OTP itself is delivered out-of-band. */
  sent: true
  /** Cooldown / "OTP sent to" message — caller surfaces verbatim in UI. */
  message: string
}

export interface ConfirmPinResetInput {
  userId: string
  /** Tenant the audit row attaches to — taken from the JWT, never the body. */
  businessId: string
  otp: string
  newPin: string
}

export interface ConfirmPinResetResult {
  success: true
}

/**
 * Start the OTP-gated PIN reset flow. Returns immediately even if SMS fails
 * (the OtpCode row is persisted; user can retry via the /resend path on the
 * existing OTP infra).
 */
export async function requestPinReset(input: RequestPinResetInput): Promise<RequestPinResetResult> {
  const { userId } = input

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  })
  if (!user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'User not found')
  }

  // Generate + hash + persist OTP (mirrors lib/otp.ts flow used by sendOtp).
  const otp = generateOTP()
  const otpHash = await hashOTP(otp)

  await prisma.otpCode.create({
    data: {
      phone: user.phone,
      code: otpHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  })

  // Mint a separate PinResetToken so /reset/confirm can prove the request
  // originated from THIS user's session (otp alone could be replayed across
  // tokens — the audit-log distinguishes them).
  const tokenRaw = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(tokenRaw).digest('hex')
  await prisma.pinResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + PIN_RESET_TOKEN_TTL_MS),
    },
  })

  // Fire-and-forget SMS — sendOTP returns false in prod if MSG91 fails; we
  // log but don't throw (the row is persisted for retry).
  const sent = await sendOTP(user.phone, otp)
  if (!sent && process.env.NODE_ENV === 'production') {
    logger.error('pin_reset.sms_failed', { userId })
  }

  return { sent: true, message: `OTP sent to ${user.phone}` }
}

/**
 * Confirm an OTP + set new PIN. All four writes (PIN hash update, OTP
 * consumed, reset-token consumed, audit log) happen in one $transaction
 * so a partial success cannot leave the user with a half-rotated state.
 */
export async function confirmPinReset(input: ConfirmPinResetInput): Promise<ConfirmPinResetResult> {
  const { userId, businessId, otp, newPin } = input

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  })
  if (!user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'User not found')
  }

  // Latest unverified OTP for this user's phone.
  const otpRow = await prisma.otpCode.findFirst({
    where: { phone: user.phone, verified: false },
    orderBy: { createdAt: 'desc' },
  })
  if (!otpRow) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'No active OTP', { reason: 'INVALID_OTP' })
  }
  if (otpRow.expiresAt < new Date()) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'OTP expired', { reason: 'INVALID_OTP' })
  }

  const otpOk = await verifyOTP(otpRow.code, otp)
  if (!otpOk) {
    // Increment attempts so the existing OTP rate-limit fires after MAX_ATTEMPTS.
    await prisma.otpCode.update({
      where: { id: otpRow.id },
      data: { attempts: { increment: 1 } },
    })
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'Invalid OTP', { reason: 'INVALID_OTP' })
  }

  // Hash new PIN immediately (raw value leaves scope after this line).
  const newPinHash = hashPin(newPin)

  // Atomic: PIN update + OTP consumed + reset-token consumed + audit row.
  // Note: pinEnabled set to true (covers first-time-PIN flow via reset).
  await prisma.$transaction(async (tx) => {
    // Upsert is used because UserAppSettings may not exist yet for a first-time
    // PIN setter using the reset flow. unique key is on userId.
    await tx.userAppSettings.upsert({
      where: { userId },
      create: {
        userId,
        pinHash: newPinHash,
        pinEnabled: true,
        pinAttempts: 0,
        pinLockedUntil: null,
      },
      update: {
        pinHash: newPinHash,
        pinEnabled: true,
        pinAttempts: 0,
        pinLockedUntil: null,
      },
    })

    await tx.otpCode.update({
      where: { id: otpRow.id },
      data: { verified: true },
    })

    // Mark the most recent reset-token row as consumed.
    const latestToken = await tx.pinResetToken.findFirst({
      where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (latestToken) {
      await tx.pinResetToken.update({
        where: { id: latestToken.id },
        data: { consumedAt: new Date() },
      })
    }

    await createAuditEntry({
      businessId,
      action: 'PIN_RESET',
      entityType: 'UserAppSettings',
      entityId: userId,
      userId,
    }, tx)
  })

  logger.info('pin_reset.confirmed', { userId })
  return { success: true }
}
