import {
  RATE_LIMIT_AUTH_WINDOW_MS,
  RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_SWITCH_BUSINESS_WINDOW_MS,
  RATE_LIMIT_SWITCH_BUSINESS_MAX,
  RATE_LIMIT_DEV_LOGIN_WINDOW_MS,
  RATE_LIMIT_DEV_LOGIN_MAX,
  RATE_LIMIT_OTP_WINDOW_MS,
  RATE_LIMIT_OTP_MAX,
} from '../../config/security.js'
import { createRateLimiter } from './factory.js'

/** 20 req/min per IP — login, send-otp (unauthenticated brute-force surface) */
export const authRateLimiter = createRateLimiter({
  name: 'auth',
  windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX,
  message: 'Too many attempts. Please try again later.',
  eventName: 'rate_limit.auth_hit',
})

/** Switch-business is already `auth`-gated — give it its own generous bucket
 *  (60/min) so multi-store owners are never locked out of hopping stores. */
export const switchBusinessRateLimiter = createRateLimiter({
  name: 'switch-business',
  windowMs: RATE_LIMIT_SWITCH_BUSINESS_WINDOW_MS,
  max: RATE_LIMIT_SWITCH_BUSINESS_MAX,
  message: 'Too many business switches. Please slow down.',
  eventName: 'rate_limit.switch_business_hit',
})

/** Dev-login limiter (only mounted when ALLOW_DEV_LOGIN=true). Generous cap so
 *  shared NATs and local automation don't exhaust the bucket during normal use. */
export const devLoginRateLimiter = createRateLimiter({
  name: 'dev-login',
  windowMs: RATE_LIMIT_DEV_LOGIN_WINDOW_MS,
  max: RATE_LIMIT_DEV_LOGIN_MAX,
  message: 'Too many dev-login attempts. Please slow down.',
  eventName: 'rate_limit.dev_login_hit',
})

/**
 * 3 req/10min per PHONE — every endpoint that sends an OTP.
 *
 * Keyed by the number, not the caller: the resource being protected is one
 * person's handset and the per-message cost of reaching it, and both belong to
 * the phone. Keying by IP at this cap would instead lock out a shop whose three
 * staff register over one wifi — the burst brake for a caller is
 * `authRateLimiter` (20/min per IP), which stays alongside this.
 *
 * MUST be mounted AFTER `validate(...)`, so the key comes from a body the
 * schema has already checked rather than from arbitrary input. The IP fallback
 * is for a request that somehow arrives without one — it must still land in a
 * bucket, never in the un-keyed void.
 */
export const otpRateLimiter = createRateLimiter({
  keyFn: (req) => {
    const phone = typeof req.body?.phone === 'string' ? req.body.phone : null
    return `rl:otp:${phone ?? `ip:${req.ip ?? 'unknown'}`}`
  },
  windowMs: RATE_LIMIT_OTP_WINDOW_MS,
  max: RATE_LIMIT_OTP_MAX,
  message: 'Too many OTP requests. Please wait before trying again.',
  eventName: 'rate_limit.otp_hit',
})
