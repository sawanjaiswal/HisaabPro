import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required')
}

if (process.env.JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET must be at least 32 characters (256 bits)')
}

const JWT_SECRET: string = process.env.JWT_SECRET
const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY = '7d'

export interface TokenPayload {
  userId: string
  phone: string
  businessId: string  // active business — '' if user has no business yet
  type: 'access' | 'refresh'
}

/** Generate access + refresh token pair */
export function generateTokens(userId: string, phone: string, businessId = '') {
  const accessToken = jwt.sign(
    { userId, phone, businessId, type: 'access' } satisfies TokenPayload,
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
  )

  const refreshToken = jwt.sign(
    { userId, phone, businessId, type: 'refresh' } satisfies TokenPayload,
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: REFRESH_TOKEN_EXPIRY } as jwt.SignOptions
  )

  return { accessToken, refreshToken }
}

/** Verify and decode an access token */
export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload
  if (decoded.type !== 'access') {
    throw new Error('Expected access token')
  }
  return decoded
}

/** Verify and decode a refresh token */
export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload
  if (decoded.type !== 'refresh') {
    throw new Error('Expected refresh token')
  }
  return decoded
}

/** Decode without verifying (for blacklist TTL extraction) */
export function decodeToken(token: string): { exp?: number } | null {
  return jwt.decode(token) as { exp?: number } | null
}

/**
 * Hash a userId for log/Sentry correlation without leaking the cuid.
 * Uses a dedicated USER_HASH_SALT (NOT JWT_SECRET) so the JWT secret can be
 * rotated without losing Sentry forensic continuity.
 *
 * Fail-open: if USER_HASH_SALT is unset, falls back to JWT_SECRET so the
 * boot path never breaks; production deploys must set USER_HASH_SALT.
 */
const USER_HASH_SALT: string = process.env.USER_HASH_SALT || JWT_SECRET
export function hashUserId(userId: string): string {
  return crypto.createHmac('sha256', USER_HASH_SALT).update(userId).digest('hex').slice(0, 16)
}
