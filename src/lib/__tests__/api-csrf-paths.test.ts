/**
 * The client's CSRF decision must match the server's exemption list.
 *
 * `needsCsrf` used to exempt the whole `/auth/` prefix on the assumption that
 * every auth route is unauthenticated. Two are not: `/auth/logout` and
 * `/auth/switch-business` carry a session and are CSRF-protected server-side
 * (server/src/middleware/csrf.ts — CSRF_EXEMPT_AUTH_PATHS lists neither). The
 * prefix therefore made both POSTs 403 forever: logout left the session alive
 * and business switching was impossible.
 * See .claude/fix-trace-logout-session-survives.md.
 */

import { describe, it, expect } from 'vitest'
import { needsCsrf } from '../api-request'

// Mirrors server/src/middleware/csrf.ts CSRF_EXEMPT_AUTH_PATHS, minus the
// `/api` mount prefix the client does not include.
const SERVER_EXEMPT = [
  '/auth/csrf-token',
  '/auth/send-otp',
  '/auth/verify-otp',
  '/auth/dev-login',
  '/auth/refresh',
  '/auth/login',
  '/auth/register',
  '/auth/verify-registration',
  '/auth/resend-otp',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/biometric/register',
  '/auth/biometric/authenticate',
  '/auth/biometric/challenge',
]

describe('needsCsrf', () => {
  it('sends the token on authenticated auth mutations', () => {
    expect(needsCsrf('POST', '/auth/logout')).toBe(true)
    expect(needsCsrf('POST', '/auth/switch-business')).toBe(true)
  })

  it('skips the token on every path the server exempts', () => {
    for (const path of SERVER_EXEMPT) {
      expect(needsCsrf('POST', path), `${path} is exempt server-side`).toBe(false)
    }
  })

  it('sends the token on ordinary mutations and never on safe methods', () => {
    expect(needsCsrf('POST', '/parties')).toBe(true)
    expect(needsCsrf('DELETE', '/invoices/1')).toBe(true)
    expect(needsCsrf('GET', '/parties')).toBe(false)
    expect(needsCsrf('GET', '/auth/me')).toBe(false)
  })
})
