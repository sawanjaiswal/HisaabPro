/**
 * Frontend feature flags — single source of truth for UI gating.
 *
 * Read at build time from Vite's `import.meta.env`. Flipping a flag in prod
 * means a CI env-var change + redeploy. Flags are baked into the bundle, so
 * once shipped the FE cohort is fixed for that build — the server-side
 * flag is what gates the cohort dynamically.
 *
 * UI consumes them like:
 *
 *   const { STAFF_HR } = FEATURES
 *   if (!STAFF_HR.enabled) return <ComingSoon />
 *
 * Note: cohortPercent on the FE is informational only. We don't bucket on the
 * client because the user can flip localStorage. Real cohort enforcement
 * happens at the server. The FE flag just hides the UI entry points (BottomNav
 * items, side-nav rows, dashboard tiles) so a user not in the cohort doesn't
 * see broken-when-clicked links.
 *
 * Rollout playbook: docs/ROLLOUT_PHASE6.md.
 */

function envBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue
  return value === 'true' || value === '1'
}

function envInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue
  const n = Number.parseInt(value, 10)
  if (Number.isNaN(n) || n < 0 || n > 100) return defaultValue
  return n
}

export const FEATURES = {
  /**
   * Phase 6 Staff & HR. Gates BottomNav "HR" entry, Side-nav HR section,
   * dashboard "Payroll" tile, /hr/* routes in App.tsx.
   *
   * When disabled, the routes still mount (lazy chunks) but the entry
   * points are hidden. A direct URL paste still loads the page — server
   * will return 404 NOT_AVAILABLE per FEATURES.STAFF_HR on the BE.
   */
  STAFF_HR: {
    enabled: envBool(import.meta.env.VITE_FEATURE_STAFF_HR, false),
    cohortPercent: envInt(import.meta.env.VITE_FEATURE_STAFF_HR_COHORT_PCT, 0),
  },

  /**
   * Phase 6 Transaction PIN. Gates the PIN-setup nudge on dashboard +
   * the PIN modal route. When disabled, PIN-protected routes simply don't
   * pop the modal (server-side check is also off via FEATURES.TRANSACTION_PIN
   * on the BE).
   */
  TRANSACTION_PIN: {
    enabled: envBool(import.meta.env.VITE_FEATURE_TRANSACTION_PIN, true),
    cohortPercent: envInt(import.meta.env.VITE_FEATURE_TRANSACTION_PIN_COHORT_PCT, 100),
  },

  /**
   * V2 Appointments — gates BottomNav "Calendar" entry and /appointments
   * routes. Server enforces the real per-business cohort via
   * FEATURES.V2_APPOINTMENTS on the BE — the FE flag hides entry points so
   * out-of-cohort users don't see broken-when-clicked links. Default OFF
   * until FE-2 ships the full surface.
   */
  V2_APPOINTMENTS: {
    enabled: envBool(import.meta.env.VITE_FEATURE_V2_APPOINTMENTS, false),
    cohortPercent: envInt(import.meta.env.VITE_FEATURE_V2_APPOINTMENTS_COHORT_PCT, 0),
  },
} as const

export type FeatureKey = keyof typeof FEATURES

/** True if the master gate is on. Use this in component conditionals. */
export function isFeatureEnabled(key: FeatureKey): boolean {
  return FEATURES[key].enabled
}
