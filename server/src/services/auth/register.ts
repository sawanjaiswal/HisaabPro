import { prisma } from '../../lib/prisma.js'
import { generateOTP, hashOTP, verifyOTP, sendOTP, OTP_TTL_MS, MAX_ATTEMPTS, RESEND_COOLDOWN_MS } from '../../lib/otp.js'
import { generateTokens } from '../../lib/jwt.js'
import bcrypt from 'bcryptjs'
import type { RegisterInput, VerifyRegistrationInput } from '../../schemas/auth.schemas.js'
import { resolveUserBusinessId } from './helpers.js'

const PASSWORD_BCRYPT_ROUNDS = 10

/**
 * Register a new user: validate phone not taken, hash password, store in OtpCode context, send OTP.
 * User record is only created AFTER OTP verification (stateless registration).
 */
export async function register(data: RegisterInput) {
  const { name, phone, password } = data

  // Check phone not already registered
  const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true } })
  if (existing) {
    return { sent: false, message: 'This phone number is already registered. Please log in.' }
  }

  // Hash password before storing
  const passwordHash = await bcrypt.hash(password, PASSWORD_BCRYPT_ROUNDS)

  // Check resend cooldown
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

  await prisma.otpCode.create({
    data: {
      phone,
      code: otpHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      context: JSON.stringify({ purpose: 'registration', name, passwordHash }),
    },
  })

  const sent = await sendOTP(phone, otp)
  if (!sent && process.env.NODE_ENV === 'production') {
    return { sent: false, message: 'Failed to send OTP. Please try again.' }
  }

  return { sent: true, message: `OTP sent to ${phone}` }
}

/**
 * Verify registration OTP and create user account.
 * Reads name + passwordHash from OtpCode context, creates User, sets cookies.
 */
export async function verifyRegistration(data: VerifyRegistrationInput) {
  const { phone, otp } = data

  const otpRecord = await prisma.otpCode.findFirst({
    where: { phone, verified: false },
    orderBy: { createdAt: 'desc' },
  })

  if (!otpRecord) {
    return { verified: false, message: 'No OTP found. Please request a new one.' }
  }

  if (new Date() > otpRecord.expiresAt) {
    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { verified: true } })
    return { verified: false, message: 'OTP expired. Please request a new one.' }
  }

  if (otpRecord.attempts >= MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { verified: true } })
    return { verified: false, message: 'Too many failed attempts. Please request a new OTP.' }
  }

  if (!(await verifyOTP(otpRecord.code, otp))) {
    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { attempts: { increment: 1 } } })
    const remaining = MAX_ATTEMPTS - otpRecord.attempts - 1
    return { verified: false, message: `Invalid OTP. ${remaining} attempts remaining.` }
  }

  // Parse registration context
  let ctx: { purpose?: string; name?: string; passwordHash?: string } = {}
  try {
    ctx = otpRecord.context ? JSON.parse(otpRecord.context) as typeof ctx : {}
  } catch { /* ignore */ }

  if (ctx.purpose !== 'registration' || !ctx.name || !ctx.passwordHash) {
    return { verified: false, message: 'Invalid registration session. Please start again.' }
  }

  // Mark OTP consumed
  await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { verified: true } })

  // Check phone not taken (race condition guard)
  const existingUser = await prisma.user.findUnique({ where: { phone }, select: { id: true } })
  if (existingUser) {
    return { verified: false, message: 'This phone number is already registered. Please log in.' }
  }

  // Create user
  const user = await prisma.user.create({
    data: { phone, name: ctx.name, passwordHash: ctx.passwordHash },
    select: { id: true, phone: true, name: true, email: true },
  })

  const businessId = await resolveUserBusinessId(user.id)
  const tokens = generateTokens(user.id, user.phone, businessId)

  return {
    verified: true,
    message: 'Registration successful',
    isNewUser: true,
    user: { id: user.id, phone: user.phone, name: user.name },
    tokens,
  }
}

/**
 * Resend OTP — enforces 30s cooldown, only for unverified phones.
 */
export async function resendOtp(phone: string) {
  const recent = await prisma.otpCode.findFirst({
    where: { phone, verified: false },
    orderBy: { createdAt: 'desc' },
  })

  if (!recent) {
    return { sent: false, message: 'No pending OTP found. Please start registration again.' }
  }

  const elapsed = Date.now() - recent.createdAt.getTime()
  if (elapsed < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
    return { sent: false, message: `Please wait ${waitSec}s before requesting a new OTP` }
  }

  // Invalidate old OTP
  await prisma.otpCode.update({ where: { id: recent.id }, data: { verified: true } })

  const otp = generateOTP()
  const otpHash = await hashOTP(otp)

  await prisma.otpCode.create({
    data: {
      phone,
      code: otpHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      context: recent.context, // carry over registration context
    },
  })

  const sent = await sendOTP(phone, otp)
  if (!sent && process.env.NODE_ENV === 'production') {
    return { sent: false, message: 'Failed to send OTP. Please try again.' }
  }

  return {
    sent: true,
    message: `OTP resent to ${phone}`,
    resendAvailableAt: new Date(Date.now() + RESEND_COOLDOWN_MS).toISOString(),
  }
}
