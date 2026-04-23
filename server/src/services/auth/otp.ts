import { prisma } from '../../lib/prisma.js'
import { generateOTP, hashOTP, verifyOTP, sendOTP, OTP_TTL_MS, MAX_ATTEMPTS, RESEND_COOLDOWN_MS } from '../../lib/otp.js'
import { generateTokens } from '../../lib/jwt.js'
import type { SendOtpInput, VerifyOtpInput } from '../../schemas/auth.schemas.js'
import {
  PROGRESSIVE_DELAY_PER_ATTEMPT_MS,
  MAX_PROGRESSIVE_DELAY_MS,
} from '../../config/security.js'
import { resolveUserBusinessId, sleep, recordFailedLogin, resetLoginAttempts } from './helpers.js'

/**
 * Send OTP to phone number.
 * Creates OtpCode record. Rate-limits resend to 30s cooldown.
 */
export async function sendOtp(data: SendOtpInput) {
  const { phone } = data

  // Check resend cooldown — find most recent unverified OTP for this phone
  const recent = await prisma.otpCode.findFirst({
    where: { phone, verified: false },
    orderBy: { createdAt: 'desc' },
  })

  if (recent) {
    const elapsed = Date.now() - recent.createdAt.getTime()
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
      return { sent: false, message: `Please wait ${waitSec}s before requesting a new OTP` }
    }
  }

  const otp = generateOTP()
  const otpHash = await hashOTP(otp)

  // Store hashed OTP — never store plaintext in DB
  await prisma.otpCode.create({
    data: {
      phone,
      code: otpHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  })

  // Send via SMS
  const sent = await sendOTP(phone, otp)

  if (!sent && process.env.NODE_ENV === 'production') {
    return { sent: false, message: 'Failed to send OTP. Please try again.' }
  }

  return { sent: true, message: `OTP sent to ${phone}` }
}

/**
 * Verify OTP and authenticate user.
 * Auto-creates user if phone is new (OTP-only signup).
 * Returns JWT tokens on success. Enforces lockout + progressive delay on failure.
 */
export async function verifyOtp(data: VerifyOtpInput) {
  const { phone, otp } = data

  // Find latest unverified OTP for this phone
  const otpRecord = await prisma.otpCode.findFirst({
    where: { phone, verified: false },
    orderBy: { createdAt: 'desc' },
  })

  if (!otpRecord) {
    return { verified: false, message: 'No OTP found. Please request a new one.' }
  }

  // Check expiry
  if (new Date() > otpRecord.expiresAt) {
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { verified: true }, // Mark expired OTP as consumed
    })
    return { verified: false, message: 'OTP expired. Please request a new one.' }
  }

  // Check max attempts
  if (otpRecord.attempts >= MAX_ATTEMPTS) {
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    })
    return { verified: false, message: 'Too many failed attempts. Please request a new OTP.' }
  }

  // Constant-time comparison (bcrypt.compare)
  if (!(await verifyOTP(otpRecord.code, otp))) {
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    })

    const remaining = MAX_ATTEMPTS - otpRecord.attempts - 1
    return { verified: false, message: `Invalid OTP. ${remaining} attempts remaining.` }
  }

  // Mark OTP as verified
  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { verified: true },
  })

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      phone: true,
      name: true,
      email: true,
      isActive: true,
      failedLoginAttempts: true,
      accountLockedUntil: true,
    },
  })

  if (user && !user.isActive) {
    return { verified: false, message: 'Account is deactivated. Please contact support.' }
  }

  // Check lockout before issuing token
  if (user?.accountLockedUntil && user.accountLockedUntil > new Date()) {
    const remainingMs = user.accountLockedUntil.getTime() - Date.now()
    const remainingMin = Math.ceil(remainingMs / 60_000)

    // Progressive delay
    const delay = Math.min(
      (user.failedLoginAttempts) * PROGRESSIVE_DELAY_PER_ATTEMPT_MS,
      MAX_PROGRESSIVE_DELAY_MS
    )
    await sleep(delay)

    await recordFailedLogin(user.id, user.failedLoginAttempts)
    return {
      verified: false,
      message: `Account locked. Try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.`,
    }
  }

  const isNewUser = !user

  if (!user) {
    user = await prisma.user.create({
      data: { phone },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        isActive: true,
        failedLoginAttempts: true,
        accountLockedUntil: true,
      },
    })
  }

  // Reset lockout on successful auth
  if (user.failedLoginAttempts > 0) {
    await resetLoginAttempts(user.id)
  }

  // Generate tokens with active businessId
  const businessId = await resolveUserBusinessId(user.id)
  const tokens = generateTokens(user.id, user.phone, businessId)

  return {
    verified: true,
    message: 'OTP verified successfully',
    isNewUser,
    user: { id: user.id, phone: user.phone, name: user.name },
    tokens,
  }
}
