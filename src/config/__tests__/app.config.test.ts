import { describe, it, expect } from 'vitest'
import { resolveAuthMode, AUTH_MODE } from '../app.config'

describe('resolveAuthMode', () => {
  it('defaults to OTP when the build declared nothing', () => {
    // The bug: an absent VITE_AUTH_MODE selected 'dev-login', whose route the
    // server refuses in production — the sign-in screen was unusable.
    expect(resolveAuthMode(undefined, 'production')).toBe('otp')
    expect(resolveAuthMode('', 'development')).toBe('otp')
  })

  it('refuses dev-login in a production build', () => {
    expect(resolveAuthMode('dev-login', 'production')).toBe('otp')
  })

  it('honours an explicit dev-login outside production', () => {
    expect(resolveAuthMode('dev-login', 'development')).toBe('dev-login')
  })

  it('honours an explicit otp', () => {
    expect(resolveAuthMode('otp', 'development')).toBe('otp')
  })

  it('never ships a dev-only default', () => {
    expect(AUTH_MODE).toBe('otp')
  })
})
