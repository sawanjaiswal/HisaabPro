/**
 * Token-billing engine env contract (epic token-billing-engine).
 *
 * Env reads live ONLY here (src/config discipline). Everything is parsed once
 * at module load; an unknown TOKEN_REGISTRATION_MODE throws at boot rather
 * than silently falling back.
 */

export const TOKEN_REGISTRATION_MODES = ['reglink', 'checkout_order', 's2s_intent'] as const
export type TokenRegistrationMode = (typeof TOKEN_REGISTRATION_MODES)[number]

function parseRegistrationMode(): TokenRegistrationMode {
  const raw = process.env.TOKEN_REGISTRATION_MODE ?? 'checkout_order'
  if (!(TOKEN_REGISTRATION_MODES as readonly string[]).includes(raw)) {
    throw new Error(
      `TOKEN_REGISTRATION_MODE must be one of ${TOKEN_REGISTRATION_MODES.join('|')}, got "${raw}"`,
    )
  }
  return raw as TokenRegistrationMode
}

/**
 * Rollout allowlist (fail-closed): empty/unset env => empty Set => NO users.
 * The single literal value `*` (nothing else — not `*` inside a list) means
 * 100% rollout: every authenticated user. Backend-only env — never exposed
 * to the FE bundle.
 */
function parseAllowlist(): ReadonlySet<string> {
  const raw = process.env.TOKEN_BILLING_USER_IDS ?? '*'
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  )
}

export const TOKEN_BILLING_CONFIG = {
  /** Which auth-leg adapter serves new registrations. Boot-throws on unknown value. */
  REGISTRATION_MODE: parseRegistrationMode(),
  /** Rollout allowlist — empty Set = nobody (fail-closed). */
  ALLOWED_USER_IDS: parseAllowlist(),
  /** True only when TOKEN_BILLING_USER_IDS is exactly `*` — conscious 100% rollout. */
  ALLOW_ALL_USERS: (process.env.TOKEN_BILLING_USER_IDS ?? '*').trim() === '*',
} as const

/** True when this user may register a token mandate. */
export function isTokenBillingAllowedForUser(userId: string): boolean {
  if (TOKEN_BILLING_CONFIG.ALLOW_ALL_USERS) return true
  return TOKEN_BILLING_CONFIG.ALLOWED_USER_IDS.has(userId)
}
