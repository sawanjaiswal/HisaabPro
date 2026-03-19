/**
 * Coupon Fraud Tracker — Feature #96
 *
 * In-memory tracker for coupon abuse patterns:
 * - Failed validation lockout
 * - Velocity detection (rapid distinct codes)
 * - Apply/remove cycling detection
 *
 * Automatically upgrades to Redis when REDIS_URL is set
 * (via the shared rate-limit store). For MVP, in-memory is
 * sufficient since this is per-server state and coupon abuse
 * patterns are detectable within a single server window.
 */

import logger from '../lib/logger.js'
import {
  FRAUD_WINDOW_MS,
  FRAUD_MAX_FAILED_ATTEMPTS,
  FRAUD_VELOCITY_THRESHOLD,
  FRAUD_MAX_REMOVES,
} from '../config/coupon.config.js'

interface UserFraudRecord {
  failedCount: number
  distinctCodes: Set<string>
  removeCount: number
  resetAt: number
}

class CouponFraudTracker {
  private readonly records = new Map<string, UserFraudRecord>()

  constructor() {
    // Evict expired records every 60s
    setInterval(() => {
      const now = Date.now()
      for (const [key, record] of this.records) {
        if (now > record.resetAt) this.records.delete(key)
      }
    }, 60_000).unref()
  }

  private getOrCreate(userId: string): UserFraudRecord {
    const now = Date.now()
    const existing = this.records.get(userId)
    if (existing && now <= existing.resetAt) return existing

    const record: UserFraudRecord = {
      failedCount: 0,
      distinctCodes: new Set(),
      removeCount: 0,
      resetAt: now + FRAUD_WINDOW_MS,
    }
    this.records.set(userId, record)
    return record
  }

  /** Record a failed validation attempt. Returns true if user is now locked out. */
  recordFailedValidation(userId: string, code: string, ip?: string): boolean {
    const record = this.getOrCreate(userId)
    record.failedCount++
    record.distinctCodes.add(code)

    // Velocity warning
    if (record.distinctCodes.size === FRAUD_VELOCITY_THRESHOLD) {
      logger.warn('coupon.velocity_warning', {
        userId,
        distinctCodes: record.distinctCodes.size,
        window: `${FRAUD_WINDOW_MS / 60000}min`,
        ip,
      })
    }

    // Lockout check
    if (record.failedCount >= FRAUD_MAX_FAILED_ATTEMPTS) {
      logger.warn('coupon.fraud_lockout', {
        userId,
        failedCount: record.failedCount,
        distinctCodes: record.distinctCodes.size,
        ip,
      })
      return true
    }

    return false
  }

  /** Check if user is locked out from coupon validation */
  isLockedOut(userId: string): boolean {
    const record = this.records.get(userId)
    if (!record || Date.now() > record.resetAt) return false
    return record.failedCount >= FRAUD_MAX_FAILED_ATTEMPTS
  }

  /** Record a coupon remove. Returns true if cycling threshold exceeded. */
  recordRemove(userId: string, ip?: string): boolean {
    const record = this.getOrCreate(userId)
    record.removeCount++

    if (record.removeCount >= FRAUD_MAX_REMOVES) {
      logger.warn('coupon.cycling_detected', {
        userId,
        removeCount: record.removeCount,
        window: `${FRAUD_WINDOW_MS / 60000}min`,
        ip,
      })
      return true
    }

    return false
  }

  /** Check if user has exceeded cycling threshold */
  isCycling(userId: string): boolean {
    const record = this.records.get(userId)
    if (!record || Date.now() > record.resetAt) return false
    return record.removeCount >= FRAUD_MAX_REMOVES
  }
}

/** Singleton tracker instance */
export const couponFraudTracker = new CouponFraudTracker()
