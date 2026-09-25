import { prisma } from '../../lib/prisma.js'
import { generateOTP, hashOTP, verifyOTP, sendOTP, OTP_TTL_MS, MAX_ATTEMPTS, RESEND_COOLDOWN_MS } from '../../lib/otp.js'
import bcrypt from 'bcryptjs'
import type { ForgotPasswordInput, ResetPasswordInput } from '../../schemas/auth.schemas.js'

const PASSWORD_BCRYPT_ROUNDS = 10

/**
 * Forgot password step 1: send OTP to registered phone.
 */
export async function forgotPassword(data: ForgotPasswordInput) {
  const identifier = (data.phone || data.email || data.identifier || '').trim().toLowerCase()

  if (!identifier) {
    return { sent: false, message: 'Phone number or email is required' }
  }

  const isEmail = identifier.includes('@')
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { phone: identifier },
      ],
    },
    select: { id: true, name: true, phone: true, email: true, isActive: true },
  })

  if (!user) {
    // Don't reveal whether account exists (security best practice)
    return { sent: true, message: `If an account exists, a reset code was sent to ${identifier}` }
  }
  if (!user.isActive) {
    return { sent: false, message: 'Account is deactivated. Please contact support.' }
  }

  // Cooldown check
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
    await prisma.otpCode.update({ where: { id: recent.id }, data: { verified: true } })
  }

  const otp = generateOTP()
  const otpHash = await hashOTP(otp)

  await prisma.otpCode.create({
    data: {
      phone: identifier,
      code: otpHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      context: JSON.stringify({ purpose: 'password_reset', userId: user.id }),
    },
  })

  if (isEmail) {
    const { sendEmailOtp } = await import('../email.service.js')
    const emailResult = await sendEmailOtp(identifier, otp, user.name || undefined)
    if (!emailResult.success && process.env.NODE_ENV === 'production') {
      return { sent: false, message: 'Failed to dispatch reset email. Please try again.' }
    }
    return { sent: true, message: `Reset OTP sent to ${identifier}` }
  }

  const sent = await sendOTP(identifier, otp)
  if (!sent && process.env.NODE_ENV === 'production') {
    return { sent: false, message: 'Failed to send OTP. Please try again.' }
  }

  return { sent: true, message: `OTP sent to ${identifier}` }
}

/**
 * Forgot password step 2: verify OTP and set new password.
 * Clears all refresh tokens (logs out all devices) on success.
 */
export async function resetPassword(data: ResetPasswordInput) {
  const { otp, newPassword } = data
  const identifier = (data.phone || data.email || data.identifier || '').trim().toLowerCase()

  if (!identifier) {
    return { success: false, message: 'Phone or email is required' }
  }

  const otpRecord = await prisma.otpCode.findFirst({
    where: { phone: identifier, verified: false },
    orderBy: { createdAt: 'desc' },
  })

  if (!otpRecord) {
    return { success: false, message: 'No OTP found. Please request a new one.' }
  }

  // Parse context — must be password_reset purpose
  let ctx: { purpose?: string; userId?: string } = {}
  try {
    ctx = otpRecord.context ? (JSON.parse(otpRecord.context) as typeof ctx) : {}
  } catch {
    /* ignore */
  }
  if (ctx.purpose !== 'password_reset') {
    return { success: false, message: 'Invalid reset session. Please start again.' }
  }

  if (new Date() > otpRecord.expiresAt) {
    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { verified: true } })
    return { success: false, message: 'OTP expired. Please request a new one.' }
  }

  if (otpRecord.attempts >= MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { verified: true } })
    return { success: false, message: 'Too many failed attempts. Please request a new OTP.' }
  }

  if (!(await verifyOTP(otpRecord.code, otp))) {
    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { attempts: { increment: 1 } } })
    const remaining = MAX_ATTEMPTS - otpRecord.attempts - 1
    return { success: false, message: `Invalid OTP. ${remaining} attempts remaining.` }
  }

  const user = ctx.userId
    ? await prisma.user.findUnique({ where: { id: ctx.userId }, select: { id: true } })
    : await prisma.user.findFirst({
        where: {
          OR: [{ email: identifier }, { phone: identifier }],
        },
        select: { id: true },
      })

  if (!user) return { success: false, message: 'Account not found.' }

  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_BCRYPT_ROUNDS)

  // Mark OTP consumed + update password + clear all sessions (security best practice)
  await Promise.all([
    prisma.otpCode.update({ where: { id: otpRecord.id }, data: { verified: true } }),
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, failedLoginAttempts: 0, accountLockedUntil: null },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'password-reset' },
    }),
  ])

  return { success: true, message: 'Password reset successfully. Please log in.' }
}
