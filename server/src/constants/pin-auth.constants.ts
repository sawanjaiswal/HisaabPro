/**
 * PIN-auth shared constants — Phase 6 PR3 (HP port of DH `pin-auth.constants.ts`).
 *
 * SSOT for retry caps, lockout windows, OTP reset-token TTL, and GC retention.
 * Services + routes import from here so no value is duplicated.
 *
 * HP adaptation: DH uses per-device lockout + per-phone rolling window. HP
 * uses the simpler per-user model on `UserAppSettings` (pinHash +
 * pinAttempts + pinLockedUntil). Per-device + per-phone constants from DH
 * are intentionally dropped — they have no schema home in HP.
 */
import * as bcryptjs from 'bcryptjs'

// ── Per-user lockout (UserAppSettings.pinAttempts / pinLockedUntil) ──────────
/** Wrong attempts before lockout. 5 matches DH device cap + Indian banking norm. */
export const PIN_MAX_ATTEMPTS = 5
/** Lockout duration on the 5th wrong PIN. */
export const PIN_LOCKOUT_MS = 30 * 60 * 1000 // 30 minutes

// ── PIN format (matches Settings.pinHash bcrypt of 4-6 digit PIN) ────────────
export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 6
/** Hindi-safe — \d matches only ASCII digits, no Devanagari numerals. */
export const PIN_REGEX = /^\d{4,6}$/

// ── bcrypt rounds for PIN hash (DH uses 10 — ~60ms; not in hot path) ─────────
export const PIN_BCRYPT_ROUNDS = 10

// ── OTP-gated reset token TTL ────────────────────────────────────────────────
export const PIN_RESET_TOKEN_TTL_MS = 10 * 60 * 1000 // 10 minutes

// ── GC retention (DPDP Act 2023 §8(7) — purpose-limited storage) ────────────
/** Consumed/expired reset-token rows older than this are purged. */
export const PIN_RESET_TOKEN_RETENTION_MS = 24 * 60 * 60 * 1000 // 24 hours
/** GC tick interval (default: every 1h; cron in production overrides). */
export const PIN_GC_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

// ── Internal: dummy bcrypt hash used for constant-time compare on missing-user.
// Computed once at module load — bcryptjs.hashSync is sync (~60ms) so the cost
// is paid at process boot, not on the verify hot path.
export const PIN_DUMMY_HASH: string = bcryptjs.hashSync('000000', PIN_BCRYPT_ROUNDS)
