import { describe, it, expect } from 'vitest'
import {
  attemptCallAt,
  cycleKeyFor,
  firstAttemptCallAt,
  graceEndFor,
  nextAttemptAfterFailure,
} from '../token-charge.ladder.js'
import { GRACE_DAYS, MAX_ATTEMPTS } from '../token-engine.constants.js'

const DAY_MS = 24 * 60 * 60 * 1000
const E = new Date('2026-08-21T10:30:45.123Z')

describe('cycleKeyFor', () => {
  it('is second-precision ISO with a cyc_ prefix (millis stripped)', () => {
    expect(cycleKeyFor(E)).toBe('cyc_2026-08-21T10:30:45Z')
  })

  it('is stable: same instant -> same key', () => {
    expect(cycleKeyFor(new Date(E.getTime()))).toBe(cycleKeyFor(E))
  })

  it('two period ends a second apart get distinct keys', () => {
    expect(cycleKeyFor(new Date(E.getTime() + 1000))).not.toBe(cycleKeyFor(E))
  })

  it('an instant with zero millis round-trips unchanged', () => {
    const clean = new Date('2026-08-21T10:30:45.000Z')
    expect(cycleKeyFor(clean)).toBe('cyc_2026-08-21T10:30:45Z')
  })
})

describe('attemptCallAt — calls at E-1 / E / E+1', () => {
  it('attempt 1 calls one day BEFORE period end (debit executes on E)', () => {
    expect(attemptCallAt(E, 1).getTime()).toBe(E.getTime() - DAY_MS)
  })

  it('attempt 2 calls ON period end', () => {
    expect(attemptCallAt(E, 2).getTime()).toBe(E.getTime())
  })

  it('attempt 3 calls one day AFTER period end', () => {
    expect(attemptCallAt(E, 3).getTime()).toBe(E.getTime() + DAY_MS)
  })

  it('firstAttemptCallAt is exactly attemptCallAt(E, 1)', () => {
    expect(firstAttemptCallAt(E).getTime()).toBe(attemptCallAt(E, 1).getTime())
  })
})

describe('graceEndFor', () => {
  it('grace horizon = E + GRACE_DAYS', () => {
    expect(graceEndFor(E).getTime()).toBe(E.getTime() + GRACE_DAYS * DAY_MS)
  })
})

describe('nextAttemptAfterFailure', () => {
  it('failure of attempt 1 advances to attempt 2 calling on E', () => {
    const next = nextAttemptAfterFailure(E, 1)
    expect(next).not.toBeNull()
    expect(next!.attemptNo).toBe(2)
    expect(next!.callAt.getTime()).toBe(E.getTime())
  })

  it('failure of attempt 2 advances to attempt 3 calling on E+1', () => {
    const next = nextAttemptAfterFailure(E, 2)
    expect(next!.attemptNo).toBe(3)
    expect(next!.callAt.getTime()).toBe(E.getTime() + DAY_MS)
  })

  it('ladder exhausts at MAX_ATTEMPTS — returns null', () => {
    expect(nextAttemptAfterFailure(E, MAX_ATTEMPTS)).toBeNull()
  })
})
