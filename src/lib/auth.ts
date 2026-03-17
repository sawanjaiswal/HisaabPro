import { api } from './api'
import type { AuthUser } from '../features/auth/auth.types'

/**
 * Auth library — cookie-based authentication.
 *
 * Tokens (access + refresh) are stored in httpOnly cookies set by the server.
 * The frontend cannot read or manage tokens directly.
 * Only the cached user is stored in sessionStorage for offline-first UX.
 */

/** Clear all client-side auth data (cached user only — cookies cleared by server) */
export function clearAuth() {
  sessionStorage.removeItem('cachedUser')
}

/** Cache user for offline access */
export function setCachedUser(user: AuthUser) {
  sessionStorage.setItem('cachedUser', JSON.stringify(user))
}

/** Get cached user */
export function getCachedUser(): AuthUser | null {
  const cached = sessionStorage.getItem('cachedUser')
  if (!cached) return null
  try {
    return JSON.parse(cached)
  } catch {
    return null
  }
}

/** Check if there's a cached session hint (user may still need server verification) */
export function hasCachedSession(): boolean {
  return sessionStorage.getItem('cachedUser') !== null
}

/** Dev login with username + password (and optional CAPTCHA token) */
export async function devLogin(
  username: string,
  password: string,
  captchaToken?: string,
  signal?: AbortSignal,
) {
  const raw = await api<{
    isNewUser: boolean
    user: GetMeRawUser
    tokens: { accessToken: string; refreshToken: string }
  }>('/auth/dev-login', {
    method: 'POST',
    body: JSON.stringify({ username, password, ...(captchaToken ? { captchaToken } : {}) }),
    signal,
  })
  const businessId = raw.user.businessUsers?.[0]?.business?.id ?? null
  return {
    isNewUser: raw.isNewUser,
    user: {
      id: raw.user.id,
      phone: raw.user.phone,
      name: raw.user.name,
      email: raw.user.email,
      businessId,
    } satisfies AuthUser,
    tokens: raw.tokens,
  }
}

// --- OTP auth (commented out for dev, restore for production) ---
// /** Send OTP to phone */
// export async function sendOtp(phone: string, signal?: AbortSignal) {
//   return api<SendOtpResponse>('/auth/send-otp', {
//     method: 'POST',
//     body: JSON.stringify({ phone }),
//     signal,
//   })
// }
//
// /** Verify OTP and get tokens */
// export async function verifyOtp(phone: string, otp: string, signal?: AbortSignal) {
//   return api<VerifyOtpResponse>('/auth/verify-otp', {
//     method: 'POST',
//     body: JSON.stringify({ phone, otp }),
//     signal,
//   })
// }

/** Refresh access token — cookies handle token transport automatically */
export async function refreshToken(signal?: AbortSignal) {
  return api<{ tokens: { accessToken: string; refreshToken: string } }>('/auth/refresh', {
    method: 'POST',
    signal,
  })
}

/** Logout — server blacklists tokens and clears cookies */
export async function logout() {
  try {
    await api('/auth/logout', {
      method: 'POST',
    })
  } catch {
    // Logout should succeed client-side even if server fails
  }
  clearAuth()
}

/** Raw shape returned by GET /auth/me — includes nested businessUsers */
interface GetMeRawUser {
  id: string
  phone: string
  name: string | null
  email: string | null
  businessUsers?: Array<{ business: { id: string } }>
}

/** Get current user profile and extract businessId from the first active business */
export async function getMe(signal?: AbortSignal): Promise<{ user: AuthUser }> {
  const raw = await api<{ user: GetMeRawUser }>('/auth/me', { signal })
  const businessId = raw.user.businessUsers?.[0]?.business?.id ?? null
  return {
    user: {
      id: raw.user.id,
      phone: raw.user.phone,
      name: raw.user.name,
      email: raw.user.email,
      businessId,
    },
  }
}
