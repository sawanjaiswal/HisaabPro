import { prisma } from '../lib/prisma.js'
import { generateOTP, verifyOTP, sendOTP, OTP_TTL_MS, MAX_ATTEMPTS, RESEND_COOLDOWN_MS } from '../lib/otp.js'
import { generateTokens, verifyRefreshToken } from '../lib/jwt.js'
import type { SendOtpInput, VerifyOtpInput } from '../schemas/auth.schemas.js'

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

  // Create OTP record
  await prisma.otpCode.create({
    data: {
      phone,
      code: otp,
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
 * Returns JWT tokens on success.
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

  // Constant-time comparison
  if (!verifyOTP(otpRecord.code, otp)) {
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
    select: { id: true, phone: true, name: true, email: true, isActive: true },
  })

  if (user && !user.isActive) {
    return { verified: false, message: 'Account is deactivated. Please contact support.' }
  }

  const isNewUser = !user

  if (!user) {
    user = await prisma.user.create({
      data: { phone },
      select: { id: true, phone: true, name: true, email: true, isActive: true },
    })
  }

  // Generate tokens
  const tokens = generateTokens(user.id, user.phone)

  return {
    verified: true,
    message: 'OTP verified successfully',
    isNewUser,
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      email: user.email,
    },
    tokens,
  }
}

/**
 * Refresh access token using a valid refresh token.
 * Checks user is still active before issuing new access token.
 */
export async function refreshAccessToken(refreshToken: string) {
  const decoded = verifyRefreshToken(refreshToken)

  // Check user is still active
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { isActive: true },
  })

  if (!user || !user.isActive) {
    return null
  }

  const tokens = generateTokens(decoded.userId, decoded.phone)

  // Return new access token, keep same refresh token
  return {
    accessToken: tokens.accessToken,
    refreshToken,
  }
}

/**
 * Get current user profile.
 */
export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
      businessUsers: {
        where: { isActive: true },
        select: {
          id: true,
          role: true,
          business: {
            select: { id: true, name: true, businessType: true },
          },
        },
      },
    },
  })

  return user
}
