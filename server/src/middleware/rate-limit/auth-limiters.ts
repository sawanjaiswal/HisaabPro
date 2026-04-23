import {
  RATE_LIMIT_AUTH_WINDOW_MS,
  RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_DEV_LOGIN_WINDOW_MS,
  RATE_LIMIT_DEV_LOGIN_MAX,
  RATE_LIMIT_OTP_WINDOW_MS,
  RATE_LIMIT_OTP_MAX,
} from '../../config/security.js'
import { createRateLimiter } from './factory.js'

/** 5 req/min per IP — login, send-otp */
export const authRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX,
  message: 'Too many attempts. Please try again later.',
  eventName: 'rate_limit.auth_hit',
})

/** Dev-login limiter (only mounted when ALLOW_DEV_LOGIN=true). Generous cap so
 *  shared NATs and local automation don't exhaust the bucket during normal use. */
export const devLoginRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_DEV_LOGIN_WINDOW_MS,
  max: RATE_LIMIT_DEV_LOGIN_MAX,
  message: 'Too many dev-login attempts. Please slow down.',
  eventName: 'rate_limit.dev_login_hit',
})

/** 3 req/10min per IP — OTP verification */
export const otpRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_OTP_WINDOW_MS,
  max: RATE_LIMIT_OTP_MAX,
  message: 'Too many OTP requests. Please wait before trying again.',
  eventName: 'rate_limit.otp_hit',
})
