import type { Response } from 'express'
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
} from '../../config/security.js'

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
