import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { generateTokens, verifyRefreshToken, hashUserId } from '../../lib/jwt.js'
import { Sentry } from '../../lib/sentry.js'
import bcrypt from 'bcryptjs'
import type { LoginInput } from '../../schemas/auth.schemas.js'
import {
  PROGRESSIVE_DELAY_PER_ATTEMPT_MS,
  MAX_PROGRESSIVE_DELAY_MS,
  REFRESH_TOKEN_TTL_MS,
} from '../../config/security.js'
import { resolveUserBusinessId, sleep, recordFailedLogin, resetLoginAttempts } from './helpers.js'
import { getMe } from './me.js'

/**
 * Error class for refresh-token rotation failures. The route handler maps
 * every variant to a generic 401 — we never leak the specific reason to the
 * client (don't tip the attacker that we detected them).
 */
export class RefreshReuseError extends Error {
  constructor(public reason:
    | 'unknown-token'
    | 'reuse-detected'
    | 'reuse-detected-race'
    | 'already-revoked'
    | 'user-inactive'
  ) {
    super(`refresh-rotation:${reason}`)
    this.name = 'RefreshReuseError'
  }
}

interface RefreshTokenRow {
  id: string
  userId: string
  family: string | null
  replacedBy: string | null
  revokedAt: Date | null
  deviceInfo: string | null
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
 * Refresh access token via family-rotation (RFC 6819 §5.2.2.3).
 *
 * Atomic via Prisma $transaction(Serializable) + SELECT FOR UPDATE row lock.
 * Reuse of an already-replaced token revokes the entire family.
 *
 * Returns new token pair on success. Throws RefreshReuseError on any
 * rotation failure (caller maps to a generic 401).
 */
export async function refreshAccessToken(refreshToken: string) {
  const decoded = verifyRefreshToken(refreshToken)

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { isActive: true },
  })
  if (!user || !user.isActive) {
    throw new RefreshReuseError('user-inactive')
  }

  // Internal sentinel — distinguishes the reuse path so we can revoke the
  // family OUTSIDE the (rolled-back-on-throw) rotation transaction.
  type Outcome =
    | { kind: 'rotated'; tokens: ReturnType<typeof generateTokens> }
    | { kind: 'reuse-detected'; userId: string; family: string; deviceInfo: string | null }
    | { kind: 'unknown' }
    | { kind: 'already-revoked' }

  let outcome: Outcome
  try {
    outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
      const rows = await tx.$queryRaw<RefreshTokenRow[]>`
        SELECT id, "userId", family, "replacedBy", "revokedAt", "deviceInfo"
        FROM "RefreshToken"
        WHERE token = ${refreshToken}
        FOR UPDATE
      `
      const row = rows[0]
      if (!row) return { kind: 'unknown' }

      if (row.revokedAt && row.replacedBy) {
        return {
          kind: 'reuse-detected',
          userId: row.userId,
          family: row.family ?? row.id,
          deviceInfo: row.deviceInfo,
        }
      }
      if (row.revokedAt) return { kind: 'already-revoked' }

      const family = row.family ?? row.id
      const businessId = await resolveUserBusinessId(decoded.userId)
      const tokens = generateTokens(decoded.userId, decoded.phone, businessId)

      const newRow = await tx.refreshToken.create({
        data: {
          userId: decoded.userId,
          token: tokens.refreshToken,
          family,
          deviceInfo: row.deviceInfo,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      })
      await tx.refreshToken.update({
        where: { id: row.id },
        data: { revokedAt: new Date(), revokedReason: 'rotated', replacedBy: newRow.id },
      })

      return { kind: 'rotated', tokens }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 = partial-unique race; P2034 = Serializable conflict.
      if (e.code === 'P2002' || e.code === 'P2034') {
        throw new RefreshReuseError('reuse-detected-race')
      }
      // Postgres 40001 "could not serialize access" leaks through $queryRaw as
      // a PrismaClientKnownRequestError without a stable Prisma code — match
      // by message substring.
      if (/40001|could not serialize/i.test(e.message)) {
        throw new RefreshReuseError('reuse-detected-race')
      }
    }
    throw e
  }

  if (outcome.kind === 'rotated') return outcome.tokens

  if (outcome.kind === 'reuse-detected') {
    // Revoke entire family OUTSIDE the rotation transaction — otherwise the
    // throw below would roll back the revocation.
    await prisma.refreshToken.updateMany({
      where: {
        userId: outcome.userId,
        OR: [{ family: outcome.family }, { id: outcome.family }],
        revokedAt: null,
      },
      data: { revokedAt: new Date(), revokedReason: 'reuse-detected' },
    })
    Sentry.captureMessage('refresh-token reuse-detected', {
      level: 'warning',
      tags: { reason: 'reuse-detected' },
      extra: {
        userIdHash: hashUserId(decoded.userId),
        family: outcome.family,
        deviceInfo: outcome.deviceInfo,
      },
    })
    throw new RefreshReuseError('reuse-detected')
  }

  if (outcome.kind === 'unknown') {
    Sentry.captureMessage('refresh-token unknown-but-valid-sig', {
      level: 'warning',
      tags: { reason: 'unknown-token-but-valid-sig' },
      extra: { userIdHash: hashUserId(decoded.userId) },
    })
    throw new RefreshReuseError('unknown-token')
  }

  throw new RefreshReuseError('already-revoked')
}
