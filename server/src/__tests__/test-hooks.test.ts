/**
 * TC-SEC-09 — the E2E hatch is not a production surface.
 *
 * `lib/test-hooks.ts` can hand a caller the OTP that was just sent to a phone.
 * That is the whole point in E2E and an account-takeover primitive in
 * production, so the claim in its header — "`NODE_ENV === 'production'` →
 * permanently disabled, no override" — has to be a tested claim, not a comment.
 *
 * This lives here rather than in the Playwright suite because the flag is read
 * from the process the server booted with: a live E2E run cannot ask what the
 * server would do under a different NODE_ENV without restarting it.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { testHooksEnabled, recordIssuedOtp, readLastOtp, clearOtpBuffer } from '../lib/test-hooks.js'

const ORIGINAL_NODE_ENV = process.env.NODE_ENV
const ORIGINAL_FLAG = process.env.E2E_TEST_HOOKS

/** `NODE_ENV` is readonly in @types/node; the test owns the process either way. */
function setEnv(nodeEnv: string | undefined, flag: string | undefined): void {
  const env = process.env as Record<string, string | undefined>
  env.NODE_ENV = nodeEnv
  env.E2E_TEST_HOOKS = flag
}

describe('test hooks are gated', () => {
  beforeEach(() => clearOtpBuffer())
  afterEach(() => {
    setEnv(ORIGINAL_NODE_ENV, ORIGINAL_FLAG)
    clearOtpBuffer()
  })

  it('production wins over the flag, however it is set', () => {
    for (const flag of ['1', 'true', 'yes', undefined]) {
      setEnv('production', flag)
      expect(testHooksEnabled(), `E2E_TEST_HOOKS=${String(flag)} in production`).toBe(false)
    }
  })

  it('a non-production env still needs the flag set to exactly "1"', () => {
    for (const flag of [undefined, '', '0', 'true', 'TRUE', 'yes']) {
      setEnv('development', flag)
      expect(testHooksEnabled(), `E2E_TEST_HOOKS=${String(flag)} in development`).toBe(false)
    }
    setEnv('development', '1')
    expect(testHooksEnabled()).toBe(true)
  })

  it('in production an OTP is neither recorded nor readable', () => {
    // Both halves matter: a read blocked while the write still buffers would
    // leave live OTPs sitting in process memory for any later leak to find.
    setEnv('production', '1')
    recordIssuedOtp('9000000001', '123456')
    expect(readLastOtp('9000000001')).toBeNull()

    // Nothing was buffered, so turning the hatch back on cannot surface it.
    setEnv('test', '1')
    expect(readLastOtp('9000000001')).toBeNull()
  })

  it('with hooks enabled the OTP round-trips (the gate is the only thing refusing)', () => {
    setEnv('test', '1')
    recordIssuedOtp('9000000002', '654321')
    expect(readLastOtp('9000000002')?.otp).toBe('654321')
  })
})
