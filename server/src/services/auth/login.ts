import { prisma } from '../../lib/prisma.js'
import { generateTokens, verifyRefreshToken } from '../../lib/jwt.js'
import bcrypt from 'bcryptjs'
import type { LoginInput } from '../../schemas/auth.schemas.js'
import {
  PROGRESSIVE_DELAY_PER_ATTEMPT_MS,
  MAX_PROGRESSIVE_DELAY_MS,
} from '../../config/security.js'
import { resolveUserBusinessId, sleep, recordFailedLogin, resetLoginAttempts } from './helpers.js'
import { getMe } from './me.js'

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
