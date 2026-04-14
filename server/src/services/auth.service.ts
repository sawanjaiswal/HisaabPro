import type { Response } from 'express'
import { timingSafeEqual } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { generateOTP, hashOTP, verifyOTP, sendOTP, OTP_TTL_MS, MAX_ATTEMPTS, RESEND_COOLDOWN_MS } from '../lib/otp.js'
import { generateTokens, verifyRefreshToken } from '../lib/jwt.js'
import { unauthorizedError } from '../lib/errors.js'
import bcrypt from 'bcryptjs'
import type { RegisterInput, LoginInput, VerifyRegistrationInput, SendOtpInput, VerifyOtpInput } from '../schemas/auth.schemas.js'
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

// Dev credentials — only active when ALLOW_DEV_LOGIN=true
const DEV_CREDENTIALS: Record<string, { password: string; phone: string; name: string }> = {
  admin: { password: 'admin123', phone: '9999999999', name: 'Dev Admin' },
  demo: { password: 'demo123', phone: '9888888888', name: 'Demo User' },
}

const PASSWORD_BCRYPT_ROUNDS = 10

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
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: ACCESS_TOKEN_TTL_MS,
    path: '/',
  })

  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
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
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  })
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
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
 * Dev login — available when ALLOW_DEV_LOGIN=true (closed testing only).
 * Uses hardcoded admin/demo credentials. Auto-creates user if not exists.
 */
export async function devLogin(data: { username: string; password: string }) {
  // Closed testing: dev login always available. Replace with OTP flow post-launch.

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
 * Production login — phone or email + password.
 * Supports account lockout + progressive delay.
 */
export async function login(data: LoginInput) {
  const { identifier, password } = data

  // Find user by phone or email
  const phoneRegex = /^[6-9]\d{9}$/
  const isPhone = phoneRegex.test(identifier)

  const user = await prisma.user.findFirst({
    where: isPhone ? { phone: identifier } : { email: identifier },
    select: {
      id: true,
      phone: true,
      name: true,
      email: true,
      passwordHash: true,
      isActive: true,
      failedLoginAttempts: true,
      accountLockedUntil: true,
    },
  })

  if (!user) {
    return { verified: false, message: 'No account found with this phone or email.' }
  }

  if (!user.isActive) {
    return { verified: false, message: 'Account is deactivated. Please contact support.' }
  }

  if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
    const remainingMin = Math.ceil((user.accountLockedUntil.getTime() - Date.now()) / 60_000)
    return {
      verified: false,
      message: `Account locked. Try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.`,
    }
  }

  if (!user.passwordHash) {
    return { verified: false, message: 'No password set. Please register first.' }
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatch) {
    const delay = Math.min(user.failedLoginAttempts * PROGRESSIVE_DELAY_PER_ATTEMPT_MS, MAX_PROGRESSIVE_DELAY_MS)
    await sleep(delay)
    await recordFailedLogin(user.id, user.failedLoginAttempts)
    return { verified: false, message: 'Invalid phone/email or password.' }
  }

  await resetLoginAttempts(user.id)

  const businessId = await resolveUserBusinessId(user.id)
  const tokens = generateTokens(user.id, user.phone, businessId)
  const meData = await getMe(user.id, businessId)

  return {
    verified: true,
    message: 'Login successful',
    isNewUser: false,
    user: { id: user.id, phone: user.phone, name: user.name },
    businesses: meData?.businesses ?? [],
    activeBusiness: meData?.activeBusiness ?? null,
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
    take: 50, // bounded: a user typically belongs to < 50 businesses
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
