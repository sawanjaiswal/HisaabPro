import { api } from './api'
import { clearApiCache } from './api-cache'
import { TIMEOUTS } from '@/config/app.config'
import type { AuthUser, BusinessSummary } from '../features/auth/auth.types'

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
  sessionStorage.removeItem('cachedBusinesses')
  // Drop the offline read cache too — the next user signing in on this
  // device must not see the previous user's PII (parties, balances, etc.).
  void clearApiCache()
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

/** Cache businesses list */
export function setCachedBusinesses(businesses: BusinessSummary[]) {
  sessionStorage.setItem('cachedBusinesses', JSON.stringify(businesses))
}

/** Get cached businesses */
export function getCachedBusinesses(): BusinessSummary[] | null {
  const cached = sessionStorage.getItem('cachedBusinesses')
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

/** Production login — phone or email + password */
export async function login(
  identifier: string,
  password: string,
  captchaToken?: string,
  signal?: AbortSignal,
) {
  const raw = await api<{
    isNewUser: boolean
    user: { id: string; phone: string; name: string | null; email: string | null }
    businesses: BusinessSummary[]
    activeBusiness: BusinessSummary | null
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier,
      password,
      ...(captchaToken ? { captchaToken } : {}),
    }),
    timeout: TIMEOUTS.authMs,
    signal,
  })
  const businessId = raw.activeBusiness?.id ?? raw.businesses[0]?.id ?? null
  return {
    isNewUser: raw.isNewUser,
    user: { ...raw.user, businessId } satisfies AuthUser,
    businesses: raw.businesses ?? [],
  }
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
    user: { id: string; phone: string; name: string | null; email: string | null }
    businesses: BusinessSummary[]
    activeBusiness: BusinessSummary | null
    tokens: { accessToken: string; refreshToken: string }
  }>('/auth/dev-login', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      ...(captchaToken ? { captchaToken } : {}),
      deviceInfo: `${navigator.userAgent.slice(0, 200)}`,
    }),
    timeout: TIMEOUTS.authMs,
    signal,
  })
  const businessId = raw.activeBusiness?.id ?? raw.businesses[0]?.id ?? null
  return {
    isNewUser: raw.isNewUser,
    user: { ...raw.user, businessId } satisfies AuthUser,
    businesses: raw.businesses ?? [],
    tokens: raw.tokens,
  }
}

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

/** Get current user profile with businesses list */
export async function getMe(signal?: AbortSignal): Promise<{
  user: AuthUser
  businesses: BusinessSummary[]
}> {
  const raw = await api<{
    user: { id: string; phone: string; name: string | null; email: string | null }
    businesses: BusinessSummary[]
    activeBusiness: BusinessSummary | null
  }>('/auth/me', { signal, timeout: TIMEOUTS.authMs })
  const businessId = raw.activeBusiness?.id ?? raw.businesses[0]?.id ?? null
  return {
    user: { ...raw.user, businessId },
    businesses: raw.businesses ?? [],
  }
}

/** Switch active business — returns new business info */
export async function switchBusiness(businessId: string, signal?: AbortSignal) {
  return api<{
    tokens: { accessToken: string; refreshToken: string }
    business: { id: string; name: string; businessType: string }
  }>('/auth/switch-business', {
    method: 'POST',
    body: JSON.stringify({ businessId }),
    signal,
  })
}

/** Join a business via invite code */
export async function joinBusiness(code: string, signal?: AbortSignal) {
  return api<{
    businessUser: { id: string; role: string; status: string }
    business: { id: string; name: string; businessType: string }
  }>('/businesses/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
    signal,
  })
}
