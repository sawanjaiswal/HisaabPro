import { api } from './api'
import type { VerifyOtpResponse, AuthUser } from '../features/auth/auth.types'

const TOKEN_KEY = 'accessToken'
const REFRESH_KEY = 'refreshToken'

/** Store tokens in sessionStorage */
export function setTokens(accessToken: string, refreshToken: string) {
  sessionStorage.setItem(TOKEN_KEY, accessToken)
  sessionStorage.setItem(REFRESH_KEY, refreshToken)
}

/** Get stored access token */
export function getAccessToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

/** Get stored refresh token */
export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY)
}

/** Clear all auth data */
export function clearAuth() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
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

/** Dev login with username + password */
export async function devLogin(username: string, password: string, signal?: AbortSignal) {
  return api<VerifyOtpResponse>('/auth/dev-login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
    signal,
  })
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

/** Refresh access token */
export async function refreshToken(signal?: AbortSignal) {
  const token = getRefreshToken()
  if (!token) throw new Error('No refresh token')
  return api<{ tokens: { accessToken: string; refreshToken: string } }>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: token }),
    signal,
  })
}

/** Logout — blacklist tokens server-side */
export async function logout() {
  const token = getRefreshToken()
  try {
    await api('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: token }),
    })
  } catch {
    // Logout should succeed client-side even if server fails
  }
  clearAuth()
}

/** Get current user profile */
export async function getMe(signal?: AbortSignal) {
  return api<{ user: AuthUser }>('/auth/me', { signal })
}
