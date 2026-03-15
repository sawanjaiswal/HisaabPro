import jwt from 'jsonwebtoken'

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required')
}

const JWT_SECRET: string = process.env.JWT_SECRET
const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY = '30d'

export interface TokenPayload {
  userId: string
  phone: string
  type: 'access' | 'refresh'
}

/** Generate access + refresh token pair */
export function generateTokens(userId: string, phone: string) {
  const accessToken = jwt.sign(
    { userId, phone, type: 'access' } satisfies TokenPayload,
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
  )

  const refreshToken = jwt.sign(
    { userId, phone, type: 'refresh' } satisfies TokenPayload,
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
