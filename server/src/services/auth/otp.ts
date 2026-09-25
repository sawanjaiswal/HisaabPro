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
  const identifier = (data.phone || data.email || data.identifier || '').trim().toLowerCase()

  if (!identifier) {
    return { sent: false, message: 'Phone number or email is required' }
  }

  // Check resend cooldown — find most recent unverified OTP for this identifier
  const recent = await prisma.otpCode.findFirst({
    where: { phone: identifier, verified: false },
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
      phone: identifier,
      code: otpHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  })

  if (identifier.includes('@')) {
    const { sendEmailOtp } = await import('../email.service.js')
    const emailResult = await sendEmailOtp(identifier, otp)
    if (!emailResult.success && process.env.NODE_ENV === 'production') {
      return { sent: false, message: 'Failed to send verification email. Please try again.' }
    }
    return { sent: true, message: `OTP sent to ${identifier}` }
  }

  // Send via SMS
  const sent = await sendOTP(identifier, otp)

  if (!sent && process.env.NODE_ENV === 'production') {
    return { sent: false, message: 'Failed to send OTP. Please try again.' }
  }

  return { sent: true, message: `OTP sent to ${identifier}` }
}

/**
 * Verify OTP and authenticate user.
 * Auto-creates user if phone is new (OTP-only signup).
 * Returns JWT tokens on success. Enforces lockout + progressive delay on failure.
 */
export async function verifyOtp(data: VerifyOtpInput) {
  const { otp } = data
  const identifier = (data.phone || data.email || data.identifier || '').trim().toLowerCase()

  if (!identifier) {
    return { verified: false, message: 'Phone or email is required' }
  }

  // Find latest unverified OTP for this identifier
  const otpRecord = await prisma.otpCode.findFirst({
    where: { phone: identifier, verified: false },
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

  const isEmail = identifier.includes('@')
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { phone: identifier },
      ],
    },
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

  let currentUser = user
  let isNewUser = false

  if (!currentUser) {
    isNewUser = true
    let placeholderPhone = !isEmail ? identifier : `9${Math.floor(100000000 + Math.random() * 900000000)}`
    while (await prisma.user.findUnique({ where: { phone: placeholderPhone } })) {
      placeholderPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`
    }
    const { createUserWithDefaultBusiness } = await import('./register.js')
    const created = await createUserWithDefaultBusiness({
      phone: placeholderPhone,
      email: isEmail ? identifier : undefined,
      name: isEmail ? identifier.split('@')[0] : `User ${placeholderPhone.slice(-4)}`,
    })
    currentUser = {
      id: created.user.id,
      phone: created.user.phone,
      name: created.user.name,
      email: created.user.email,
      isActive: true,
      failedLoginAttempts: 0,
      accountLockedUntil: null,
    }
  }

  // Reset lockout on successful auth
  if (currentUser.failedLoginAttempts > 0) {
    await resetLoginAttempts(currentUser.id)
  }

  // Generate tokens with active businessId
  const businessId = await resolveUserBusinessId(currentUser.id)
  const tokens = generateTokens(currentUser.id, currentUser.phone, businessId)

  return {
    verified: true,
    message: 'OTP verified successfully',
    isNewUser,
    user: { id: currentUser.id, phone: currentUser.phone, name: currentUser.name, email: currentUser.email },
    tokens,
  }
}
