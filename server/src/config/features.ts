/**
 * Feature flags — single source of truth for backend-side gating.
 *
 * Read at module-init from process.env so a flag flip is one env-var change +
 * service restart on Render. No DB read, no remote-config call — flags are
 * server-process-scoped.
 *
 * Each flag follows the same shape:
 *
 *   FEATURES.<NAME>.enabled        → boolean (master gate)
 *   FEATURES.<NAME>.cohortPercent  → 0..100 (percentage rollout)
 *
 * Routes consume them like:
 *
 *   if (!FEATURES.STAFF_HR.enabled) {
 *     throw new AppError(ErrorCode.FORBIDDEN, 404, 'NOT_AVAILABLE')
 *   }
 *
 * Cohort gating (when 0 < cohortPercent < 100) uses
 * `hash(userId) % 100 < cohortPercent`. Sticky bucketing — a given userId is
 * always in or out for a given percent, so a user does not see Phase-6 UI
 * appear and disappear across requests.
 *
 * Rollout playbook: docs/ROLLOUT_PHASE6.md.
 */

function envBool(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key]
  if (raw === undefined || raw === '') return defaultValue
  return raw === 'true' || raw === '1'
}

function envInt(key: string, defaultValue: number): number {
  const raw = process.env[key]
  if (raw === undefined || raw === '') return defaultValue
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n) || n < 0 || n > 100) return defaultValue
  return n
}

export const FEATURES = {
  /**
   * Phase 6 Staff & HR (#135 Attendance, #136 Payroll, #137 Slips, #138
   * Multi-firm tenancy elevation, #139 Audit Trail).
   *
   * Gates: /api/hr/*, /api/payroll/*, /api/audit/*, multi-firm switch UI.
   * Independent of TRANSACTION_PIN (a tenant can have HR on without PIN —
   * though FINALIZE will then run without PIN protection; we recommend
   * shipping both flags together per architecture §16).
   */
  STAFF_HR: {
    enabled: envBool('FEATURE_STAFF_HR', false),
    cohortPercent: envInt('FEATURE_STAFF_HR_COHORT_PCT', 0),
  },

  /**
   * Phase 6 Transaction PIN (#140). Gates: requireRecentPin middleware
   * activation. When disabled, PIN-gated routes pass through without
   * grace-cookie checks — useful for emergency rollback if PIN issuance
   * breaks for a cohort.
   *
   * Default ON: existing tenants have already enrolled in PIN through
   * PR3, so flipping it off would silently widen the attack surface.
   */
  TRANSACTION_PIN: {
    enabled: envBool('FEATURE_TRANSACTION_PIN', true),
    cohortPercent: envInt('FEATURE_TRANSACTION_PIN_COHORT_PCT', 100),
  },

  /**
   * Phase 7 slice 7.1A — Party Import. Gates: /api/imports/*.
   * Default OFF; rollout playbook lives in ROLLOUT_PHASE7.md (#TBD).
   */
  DATA_IMPORT: {
    enabled: envBool('FEATURE_DATA_IMPORT', false),
    cohortPercent: envInt('FEATURE_DATA_IMPORT_COHORT_PCT', 0),
  },

  /**
   * V2 Appointments (Phase 1B). Gates /api/appointments/*, /api/p/booking/*,
   * and the rotate-booking-secret endpoint. SALON+CLINIC verticals only —
   * route layer enforces vertical scope on top of this flag.
   * Default OFF; 4-stage cohort ramp via `FEATURE_V2_APPOINTMENTS_COHORT_PCT`.
   */
  V2_APPOINTMENTS: {
    enabled: envBool('FEATURE_V2_APPOINTMENTS', false),
    cohortPercent: envInt('FEATURE_V2_APPOINTMENTS_COHORT_PCT', 0),
  },
} as const

export type FeatureKey = keyof typeof FEATURES

/**
 * Returns true if the feature is enabled for this userId. Sticky bucketing:
 * a given userId returns the same result across requests for a given
 * cohortPercent setting.
 *
 * `enabled === false` → always false (master gate).
 * `cohortPercent === 100` → always true if enabled.
 * `cohortPercent === 0` → always false (even if enabled, no cohort is in).
 * `0 < cohortPercent < 100` → `hash(userId) % 100 < cohortPercent`.
 */
export function isFeatureEnabledForUser(key: FeatureKey, userId: string): boolean {
  const flag = FEATURES[key]
  if (!flag.enabled) return false
  if (flag.cohortPercent >= 100) return true
  if (flag.cohortPercent <= 0) return false
  return hashUserId(userId) % 100 < flag.cohortPercent
}

/**
 * djb2 hash — deterministic, 0-tokens, no crypto needed. We're not protecting
 * a secret; we just want stable bucketing across requests for the same
 * userId. The input is already opaque (UUID), so a weak hash is fine.
 */
function hashUserId(userId: string): number {
  let h = 5381
  for (let i = 0; i < userId.length; i++) {
    h = ((h << 5) + h + userId.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}
