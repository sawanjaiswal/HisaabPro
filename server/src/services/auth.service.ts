import type { Response } from 'express'
import { timingSafeEqual } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { generateOTP, hashOTP, verifyOTP, sendOTP, OTP_TTL_MS, MAX_ATTEMPTS, RESEND_COOLDOWN_MS } from '../lib/otp.js'
import { generateTokens, verifyRefreshToken } from '../lib/jwt.js'
import { unauthorizedError } from '../lib/errors.js'
import type { SendOtpInput, VerifyOtpInput } from '../schemas/auth.schemas.js'
import {
  LOCKOUT_MAX_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  PROGRESSIVE_DELAY_PER_ATTEMPT_MS,
  MAX_PROGRESSIVE_DELAY_MS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
} from '../config/security.js'

// Dev-only credentials (not for production)
const DEV_CREDENTIALS: Record<string, { password: string; phone: string; name: string }> = {
  admin: { password: 'admin123', phone: '9999999999', name: 'Dev Admin' },
  demo: { password: 'demo123', phone: '9888888888', name: 'Demo User' },
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

/**
 * Set access + refresh JWT tokens as httpOnly Secure cookies on the response.
 * Uses __Host- prefix: browser enforces Secure + path=/, no domain attribute needed.
 */
export function setTokenCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string }
) {
  const isProduction = process.env.NODE_ENV === 'production'

  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: ACCESS_TOKEN_TTL_MS,
    path: '/',
  })

  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/api/auth',
  })
}

/**
 * Clear auth cookies on logout.
 */
export function clearTokenCookies(res: Response) {
  const isProduction = process.env.NODE_ENV === 'production'

  res.clearCookie(ACCESS_TOKEN_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
  })
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/api/auth',
  })
}

// ---------------------------------------------------------------------------
// Business resolution helper
// ---------------------------------------------------------------------------

/**
 * Resolve the active businessId for a user.
 * Prefers lastActiveBusinessId if still valid, otherwise first active business.
 * Returns '' if the user has no active business.
 */
async function resolveUserBusinessId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      lastActiveBusinessId: true,
      businessUsers: {
        where: { isActive: true, status: 'ACTIVE' },
        select: { businessId: true },
        orderBy: { joinedAt: 'asc' },
        take: 10,
      },
    },
  })

  if (!user || user.businessUsers.length === 0) return ''

  // Prefer lastActiveBusinessId if still valid
  if (user.lastActiveBusinessId) {
    const isValid = user.businessUsers.some(bu => bu.businessId === user.lastActiveBusinessId)
    if (isValid) return user.lastActiveBusinessId
  }

  return user.businessUsers[0].businessId
}

// ---------------------------------------------------------------------------
// Account lockout helpers
// ---------------------------------------------------------------------------

/** Sleep for `ms` milliseconds (used for progressive delay on failed login) */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Increment failed login counter; lock account after LOCKOUT_MAX_ATTEMPTS */
async function recordFailedLogin(userId: string, currentAttempts: number): Promise<void> {
  const newAttempts = currentAttempts + 1
  const shouldLock = newAttempts >= LOCKOUT_MAX_ATTEMPTS

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: newAttempts,
      lastFailedLoginAt: new Date(),
      ...(shouldLock && { accountLockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) }),
    },
  })
}

/** Reset lockout state after a successful login */
async function resetLoginAttempts(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lastFailedLoginAt: null,
      accountLockedUntil: null,
    },
  })
}

// ---------------------------------------------------------------------------
// Auth operations
// ---------------------------------------------------------------------------

/**
 * Dev-only login with username + password.
 * Auto-creates user if not exists.
 * Supports account lockout + progressive delay.
 * BLOCKED in production — only available when NODE_ENV !== 'production'.
 */
export async function devLogin(data: { username: string; password: string }) {
  if (process.env.NODE_ENV === 'production') {
    return { verified: false, message: 'Dev login is not available in production' }
  }

  const { username, password } = data

  const creds = DEV_CREDENTIALS[username]
  if (!creds) {
    return { verified: false, message: 'Invalid username or password' }
  }

  // Constant-time comparison to prevent timing attacks
  const expected = Buffer.from(creds.password)
  const received = Buffer.from(password)
  const passwordMatch =
    expected.length === received.length &&
    timingSafeEqual(expected, received)
  if (!passwordMatch) {
    return { verified: false, message: 'Invalid username or password' }
  }

  // Find or create user by phone
  let user = await prisma.user.findUnique({
    where: { phone: creds.phone },
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

  const isNewUser = !user

  if (!user) {
    user = await prisma.user.create({
      data: { phone: creds.phone, name: creds.name },
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

  if (!user.isActive) {
    return { verified: false, message: 'Account is deactivated' }
  }

  // Check lockout
  if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
    const remainingMs = user.accountLockedUntil.getTime() - Date.now()
    const remainingMin = Math.ceil(remainingMs / 60_000)
    return {
      verified: false,
      message: `Account locked. Try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.`,
    }
  }

  // Dev login always succeeds for valid credentials — reset attempts
  await resetLoginAttempts(user.id)

  const businessId = await resolveUserBusinessId(user.id)
  const tokens = generateTokens(user.id, user.phone, businessId)

  return {
    verified: true,
    message: 'Login successful',
    isNewUser,
    user: { id: user.id, phone: user.phone, name: user.name },
    tokens,
  }
}

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

/**
 * Refresh access token using a valid refresh token.
 * Checks user is still active before issuing new access token.
 * Re-resolves businessId to ensure membership is still valid.
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

  // Re-resolve businessId in case user was removed from business
  const businessId = await resolveUserBusinessId(decoded.userId)
  const tokens = generateTokens(decoded.userId, decoded.phone, businessId)

  // Return new token pair (rotate both for security)
  return tokens
}

/**
 * Get current user profile with businesses and active business details.
 */
export async function getMe(userId: string, activeBusinessId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
      lastActiveBusinessId: true,
      businessUsers: {
        where: { isActive: true, status: 'ACTIVE' },
        select: {
          role: true,
          status: true,
          lastActiveAt: true,
          roleRef: { select: { id: true, name: true } },
          business: { select: { id: true, name: true, businessType: true } },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  })

  if (!user) return null

  const businesses = user.businessUsers.map(bu => ({
    id: bu.business.id,
    name: bu.business.name,
    businessType: bu.business.businessType,
    role: bu.role,
    roleId: bu.roleRef?.id ?? null,
    roleName: bu.roleRef?.name ?? bu.role,
    status: bu.status,
    lastActiveAt: bu.lastActiveAt,
  }))

  const currentBizId = activeBusinessId || user.lastActiveBusinessId
  const activeBusiness = businesses.find(b => b.id === currentBizId) ?? businesses[0] ?? null

  return {
    user: { id: user.id, phone: user.phone, name: user.name },
    businesses,
    activeBusiness,
  }
}

/**
 * Switch the user's active business.
 * Validates membership, generates new JWT, updates lastActiveBusinessId.
 */
export async function switchBusiness(userId: string, phone: string, targetBusinessId: string) {
  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId: targetBusinessId } },
    select: {
      isActive: true,
      status: true,
      business: { select: { id: true, name: true, businessType: true } },
    },
  })

  if (!bu || !bu.isActive || bu.status !== 'ACTIVE') {
    throw unauthorizedError('You do not have access to this business')
  }

  const tokens = generateTokens(userId, phone, targetBusinessId)

  // Update lastActiveBusinessId + lastActiveAt in parallel
  await Promise.all([
    prisma.user.update({
      where: { id: userId },
      data: { lastActiveBusinessId: targetBusinessId },
    }),
    prisma.businessUser.update({
      where: { userId_businessId: { userId, businessId: targetBusinessId } },
      data: { lastActiveAt: new Date() },
    }),
  ])

  return { tokens, business: bu.business }
}

/**
 * List all businesses the user belongs to.
 */
export async function listUserBusinesses(userId: string) {
  const businessUsers = await prisma.businessUser.findMany({
    where: { userId, isActive: true, status: 'ACTIVE' },
    select: {
      role: true,
      status: true,
      lastActiveAt: true,
      roleRef: { select: { id: true, name: true } },
      business: { select: { id: true, name: true, businessType: true } },
    },
    orderBy: { joinedAt: 'asc' },
  })

  return businessUsers.map(bu => ({
    id: bu.business.id,
    name: bu.business.name,
    businessType: bu.business.businessType,
    role: bu.role,
    roleName: bu.roleRef?.name ?? bu.role,
    status: bu.status,
    lastActiveAt: bu.lastActiveAt,
  }))
}
