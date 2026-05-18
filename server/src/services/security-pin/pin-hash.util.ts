/**
 * PIN hash utilities — bcryptjs (pure-JS, no native addon).
 *
 * HP port of DH `services/auth-pin/pin-hash.util.ts`.
 *
 * Security contract:
 *   1. hashPin: rounds=10 (~60ms) — DH parity, ≥ Indian banking norm.
 *   2. comparePin: ALWAYS called even on missing-user/missing-row paths
 *      (caller passes DUMMY hash). NEVER short-circuit with `===` on hashes.
 *   3. PIN values MUST NOT appear in any logger call (enforced at call sites).
 *
 * Sync API is intentional — PIN ops are user-initiated, low concurrency, not
 * on the request hot path beyond auth-pin/* routes.
 */
import * as bcryptjs from 'bcryptjs'
import { PIN_BCRYPT_ROUNDS } from '../../constants/pin-auth.constants.js'

/**
 * Hash a 4-6 digit PIN. Caller MUST have Zod-validated the PIN shape first
 * (`PIN_REGEX`). Output is a bcrypt-2b-format string.
 */
export function hashPin(pin: string): string {
  return bcryptjs.hashSync(pin, PIN_BCRYPT_ROUNDS)
}

/**
 * Constant-time compare a raw PIN to a stored bcrypt hash.
 *
 * bcryptjs.compareSync runs the full Blowfish expansion regardless of
 * early byte mismatch — equivalent timing whether the hash is real or the
 * DUMMY hash (caller wraps with `?? PIN_DUMMY_HASH`).
 */
export function comparePin(pin: string, hash: string): boolean {
  return bcryptjs.compareSync(pin, hash)
}
