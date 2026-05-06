/**
 * BAT-03 — Expiry Policy Tests
 *
 * 8 cases:
 *   1. Expired batch + HARD_BLOCK → throws EXPIRED_BATCH
 *   2. Expired batch + WARN_ONLY  → surfaces warning, returns in allowed
 *   3. Mix expired+fresh + HARD_BLOCK → fresh only in allowed
 *   4. Mix expired+fresh + WARN_ONLY  → both in allowed + warning
 *   5. All expired + HARD_BLOCK  → throws ALL_BATCHES_EXPIRED
 *   6. All expired + WARN_ONLY   → all allowed + warnings
 *   7. Null expiryDate → never expired
 *   8. IST midnight boundary — batch expires exactly at midnight IST
 */

import { describe, it, expect } from 'vitest'
import { isExpired, evaluateBatchPolicy, checkSingleBatch } from '../expiry-policy.js'
import { istMidnightUtc } from '../../../lib/date.js'
import type { BatchForPolicy } from '../expiry-policy.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDate(daysFromToday: number, today = new Date()): Date {
  const d = new Date(today.getTime())
  d.setUTCDate(d.getUTCDate() + daysFromToday)
  return d
}

function makeBatch(overrides: Partial<BatchForPolicy> & { id?: string }): BatchForPolicy {
  return {
    id: overrides.id ?? 'batch-1',
    batchNumber: overrides.batchNumber ?? 'B001',
    expiryDate: overrides.expiryDate ?? null,
    productId: 'prod-1',
    productName: 'Paracetamol 500mg',
    currentStock: overrides.currentStock ?? 100,
    costPriceAtClaim: null,
    ...overrides,
  }
}

const TODAY = istMidnightUtc()
const YESTERDAY_EXPIRY = makeDate(-1, TODAY)  // expired
const TOMORROW_EXPIRY  = makeDate(1, TODAY)   // valid

// ---------------------------------------------------------------------------
// Case 1: Expired batch + HARD_BLOCK → throws EXPIRED_BATCH
// ---------------------------------------------------------------------------

describe('Case 1 — expired batch HARD_BLOCK throws EXPIRED_BATCH', () => {
  it('throws 409 with code EXPIRED_BATCH', () => {
    const batch = makeBatch({ expiryDate: YESTERDAY_EXPIRY })
    expect(() =>
      checkSingleBatch(batch, 'HARD_BLOCK', TODAY)
    ).toThrow()

    try {
      checkSingleBatch(batch, 'HARD_BLOCK', TODAY)
    } catch (err: unknown) {
      const e = err as { code: string; statusCode: number }
      expect(e.code).toBe('EXPIRED_BATCH')
      expect(e.statusCode).toBe(409)
    }
  })
})

// ---------------------------------------------------------------------------
// Case 2: Expired batch + WARN_ONLY → surfaces warning, included in allowed
// ---------------------------------------------------------------------------

describe('Case 2 — expired batch WARN_ONLY surfaces warning', () => {
  it('returns ExpiryWarning and does not throw', () => {
    const batch = makeBatch({ expiryDate: YESTERDAY_EXPIRY })
    const warning = checkSingleBatch(batch, 'WARN_ONLY', TODAY)
    expect(warning).not.toBeNull()
    expect(warning?.type).toBe('EXPIRED_BATCH')
    expect(warning?.batchId).toBe(batch.id)
  })
})

// ---------------------------------------------------------------------------
// Case 3: Mix expired + fresh + HARD_BLOCK → fresh only in allowed
// ---------------------------------------------------------------------------

describe('Case 3 — mix HARD_BLOCK uses fresh only', () => {
  it('filters expired batch out of allowed', () => {
    const expired = makeBatch({ id: 'exp', expiryDate: YESTERDAY_EXPIRY })
    const fresh   = makeBatch({ id: 'fresh', expiryDate: TOMORROW_EXPIRY })

    const result = evaluateBatchPolicy({
      batches: [expired, fresh],
      policy: 'HARD_BLOCK',
      asOf: TODAY,
    })

    expect(result.allowed).toHaveLength(1)
    expect(result.allowed[0].batchId).toBe('fresh')
    expect(result.expired).toHaveLength(1)
    expect(result.warnings).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Case 4: Mix expired + fresh + WARN_ONLY → both in allowed + warning
// ---------------------------------------------------------------------------

describe('Case 4 — mix WARN_ONLY uses both', () => {
  it('includes expired batch and populates warnings', () => {
    const expired = makeBatch({ id: 'exp', expiryDate: YESTERDAY_EXPIRY })
    const fresh   = makeBatch({ id: 'fresh', expiryDate: TOMORROW_EXPIRY })

    const result = evaluateBatchPolicy({
      batches: [expired, fresh],
      policy: 'WARN_ONLY',
      asOf: TODAY,
    })

    expect(result.allowed).toHaveLength(2)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('expired')
  })
})

// ---------------------------------------------------------------------------
// Case 5: All expired + HARD_BLOCK → throws ALL_BATCHES_EXPIRED
// ---------------------------------------------------------------------------

describe('Case 5 — all expired HARD_BLOCK throws ALL_BATCHES_EXPIRED', () => {
  it('throws 409 with code ALL_BATCHES_EXPIRED', () => {
    const batches = [
      makeBatch({ id: 'exp1', expiryDate: YESTERDAY_EXPIRY }),
      makeBatch({ id: 'exp2', expiryDate: makeDate(-5, TODAY) }),
    ]

    expect(() =>
      evaluateBatchPolicy({ batches, policy: 'HARD_BLOCK', asOf: TODAY })
    ).toThrow()

    try {
      evaluateBatchPolicy({ batches, policy: 'HARD_BLOCK', asOf: TODAY })
    } catch (err: unknown) {
      const e = err as { code: string; statusCode: number }
      expect(e.code).toBe('ALL_BATCHES_EXPIRED')
      expect(e.statusCode).toBe(409)
    }
  })
})

// ---------------------------------------------------------------------------
// Case 6: All expired + WARN_ONLY → all allowed + warnings
// ---------------------------------------------------------------------------

describe('Case 6 — all expired WARN_ONLY allows with warnings', () => {
  it('returns all batches in allowed and warning per batch', () => {
    const batches = [
      makeBatch({ id: 'exp1', expiryDate: YESTERDAY_EXPIRY }),
      makeBatch({ id: 'exp2', expiryDate: makeDate(-5, TODAY) }),
    ]

    const result = evaluateBatchPolicy({ batches, policy: 'WARN_ONLY', asOf: TODAY })

    expect(result.allowed).toHaveLength(2)
    expect(result.warnings).toHaveLength(2)
    expect(result.expired).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Case 7: Null expiryDate → never expired
// ---------------------------------------------------------------------------

describe('Case 7 — null expiryDate is never expired', () => {
  it('isExpired returns false for null expiryDate', () => {
    const batch = makeBatch({ expiryDate: null })
    expect(isExpired(batch, TODAY)).toBe(false)
  })

  it('evaluateBatchPolicy includes null-expiry batch in allowed (HARD_BLOCK)', () => {
    const batch = makeBatch({ id: 'no-expiry', expiryDate: null })
    const result = evaluateBatchPolicy({
      batches: [batch],
      policy: 'HARD_BLOCK',
      asOf: TODAY,
    })
    expect(result.allowed).toHaveLength(1)
    expect(result.expired).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Case 8: IST midnight boundary — batch expires exactly at midnight IST
// ---------------------------------------------------------------------------

describe('Case 8 — IST midnight boundary', () => {
  /**
   * India has no DST. Midnight IST = 18:30 UTC of the PREVIOUS calendar day.
   * If expiryDate = today's IST midnight in UTC, the batch is expired
   * (expiryDate <= today-midnight-UTC).
   */
  it('batch with expiryDate == istMidnightUtc is considered expired', () => {
    // expiryDate equals today's IST midnight — should be expired (inclusive)
    const batch = makeBatch({ expiryDate: new Date(TODAY.getTime()) })
    expect(isExpired(batch, TODAY)).toBe(true)
  })

  it('batch with expiryDate 1ms after istMidnightUtc is NOT expired', () => {
    const justAfterMidnight = new Date(TODAY.getTime() + 1)
    const batch = makeBatch({ expiryDate: justAfterMidnight })
    expect(isExpired(batch, TODAY)).toBe(false)
  })

  it('istMidnightUtc produces 18:30 UTC for a given IST day', () => {
    // 2026-05-06 06:00:00 IST = 2026-05-06 00:30:00 UTC
    // midnight IST for that day = 2026-05-05 18:30:00 UTC
    const istNoon = new Date('2026-05-06T00:30:00Z') // 06:00 IST
    const midnight = istMidnightUtc(istNoon)
    // Expect 2026-05-05T18:30:00.000Z
    expect(midnight.toISOString()).toBe('2026-05-05T18:30:00.000Z')
  })
})
