/**
 * E2E test hooks — OFF unless explicitly enabled, and impossible in production.
 *
 * Why this exists: OTPs are bcrypt-hashed before they touch the database
 * (`otp.ts` → `hashOTP`), which is correct and must not change. That leaves
 * browser automation with no way to read the code it was just sent, so the
 * whole registration/login surface (TC-REG, TC-AUTH) is untestable without a
 * deliberate, narrow escape hatch.
 *
 * The hatch is this module. Guarantees:
 *   - `NODE_ENV === 'production'` → permanently disabled, no override
 *   - requires `E2E_TEST_HOOKS=1` to be set at boot
 *   - buffer is in-memory only (never persisted, gone on restart)
 *   - bounded to MAX_ENTRIES and TTL_MS so it cannot grow or leak over time
 *
 * Deliberately NOT wired into `lib/env.ts`: this is a test affordance, not part
 * of the production environment contract, and adding it there would make a
 * test-only variable look like a supported deployment knob.
 */

const MAX_ENTRIES = 50
const TTL_MS = 5 * 60 * 1000

interface OtpRecord {
  phone: string
  otp: string
  at: number
}

/** Insertion-ordered; oldest evicted first. */
const buffer: OtpRecord[] = []

/** Single source of truth for whether any hook may run. Checked per call. */
export function testHooksEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.E2E_TEST_HOOKS === '1'
}

/**
 * Record an issued OTP. No-op unless hooks are enabled — safe to call
 * unconditionally from the send path.
 */
export function recordIssuedOtp(phone: string, otp: string): void {
  if (!testHooksEnabled()) return
  buffer.push({ phone, otp, at: Date.now() })
  while (buffer.length > MAX_ENTRIES) buffer.shift()
}

/** Most recent un-expired OTP for a phone, or null. */
export function readLastOtp(phone: string): OtpRecord | null {
  if (!testHooksEnabled()) return null
  const cutoff = Date.now() - TTL_MS
  for (let i = buffer.length - 1; i >= 0; i--) {
    const entry = buffer[i]
    if (entry.phone === phone && entry.at >= cutoff) return entry
  }
  return null
}

/** Drop everything — called between E2E scenarios so runs cannot bleed. */
export function clearOtpBuffer(): void {
  buffer.length = 0
}
