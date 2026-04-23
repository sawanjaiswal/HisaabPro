import {
  RATE_LIMIT_COUPON_VALIDATE_WINDOW_MS,
  RATE_LIMIT_COUPON_VALIDATE_MAX,
  RATE_LIMIT_COUPON_IP_WINDOW_MS,
  RATE_LIMIT_COUPON_IP_MAX,
} from '../../config/security.js'
import { createRateLimiter } from './factory.js'

/** 10 req/min per authenticated user — coupon code validation (brute-force prevention) */
export const couponValidateRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_COUPON_VALIDATE_WINDOW_MS,
  max: RATE_LIMIT_COUPON_VALIDATE_MAX,
  message: 'Too many coupon validation attempts. Please try again later.',
  keyFn: (req) => `rl:coupon:${req.user?.userId ?? req.ip ?? 'unknown'}`,
  eventName: 'rate_limit.coupon_validate_hit',
})

/** 20 req/min per IP — coupon endpoints (cross-user brute-force on shared IPs) */
export const couponIpRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_COUPON_IP_WINDOW_MS,
  max: RATE_LIMIT_COUPON_IP_MAX,
  message: 'Too many coupon requests from this network. Please try again later.',
  keyFn: (req) => `rl:coupon-ip:${req.ip ?? 'unknown'}`,
  eventName: 'rate_limit.coupon_ip_hit',
})
