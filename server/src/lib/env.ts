/**
 * Entitlement JWT + Subscription env helpers.
 * All optional — services degrade gracefully when keys are absent.
 */

/** RS256 private key PEM for signing entitlement JWTs. Optional. */
export function getEntitlementPrivateKey(): string | undefined {
  return process.env.ENTITLEMENT_PRIVATE_KEY
}

/** RS256 public key PEM for verifying entitlement JWTs. Optional. */
export function getEntitlementPublicKey(): string | undefined {
  return process.env.ENTITLEMENT_PUBLIC_KEY
}

/** Previous RS256 public key PEM for key rotation window. Optional. */
export function getEntitlementKeyPrev(): string | undefined {
  return process.env.ENTITLEMENT_KEY_PREV
}

/** Razorpay PRO_MAX plan ID. Optional — prints warning if absent. */
export function getRazorpayPlanProMax(): string | undefined {
  const id = process.env.RAZORPAY_PLAN_PRO_MAX
  if (!id) {
    // warn on first call only
    process.env._RAZORPAY_PRO_MAX_WARNED ??= 'true'
    if (process.env._RAZORPAY_PRO_MAX_WARNED === 'true') {
      process.env._RAZORPAY_PRO_MAX_WARNED = 'warned'
    }
  }
  return id
}

/**
 * Resolve the Razorpay plan ID for a paid tier + billing cycle.
 *
 * A YEARLY checkout with a missing `RAZORPAY_PLAN_<TIER>_YEARLY` env var must
 * NOT silently fall back to the monthly plan — that would bill a yearly buyer
 * a monthly plan. The caller maps `{ ok: false }` to a 503 so the buyer is
 * never charged the wrong cadence.
 */
export type RazorpayPlanResolution =
  | { ok: true; planId: string }
  | { ok: false; missing: 'MONTHLY' | 'YEARLY' }

export function getRazorpayPlanId(
  tier: 'PRO' | 'BUSINESS' | 'PRO_MAX',
  cycle: 'MONTHLY' | 'YEARLY',
): RazorpayPlanResolution {
  const monthly: Record<typeof tier, string | undefined> = {
    PRO: process.env.RAZORPAY_PLAN_PRO,
    BUSINESS: process.env.RAZORPAY_PLAN_BUSINESS,
    PRO_MAX: process.env.RAZORPAY_PLAN_PRO_MAX,
  }
  const monthlyId = monthly[tier]
  if (!monthlyId) return { ok: false, missing: 'MONTHLY' }
  if (cycle === 'YEARLY') {
    const yearlyId = process.env[`RAZORPAY_PLAN_${tier}_YEARLY`]
    if (!yearlyId) return { ok: false, missing: 'YEARLY' }
    return { ok: true, planId: yearlyId }
  }
  return { ok: true, planId: monthlyId }
}

/** Overflow grace period days. Default 3. */
export function getOverflowGraceDays(): number {
  return parseInt(process.env.SUBSCRIPTION_OVERFLOW_GRACE_DAYS ?? '3', 10)
}

/** Subscription grace period days (for PAST_DUE). Default 7. */
export function getSubscriptionGraceDays(): number {
  return parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS ?? '7', 10)
}

/**
 * NIC environment contract validator.
 * Called once at server boot. MB-5 boot-fail: prod creds in non-prod env throws.
 *
 * All NIC vars are optional (stub mode when absent).
 * NIC_ENV only switches sandbox/prod keys — never contains a URL.
 */

import logger from './logger.js'

export type NicEnvKey = 'sandbox' | 'prod'

const VALID_NIC_ENVS: NicEnvKey[] = ['sandbox', 'prod']

/** Called from server entry-point after dotenv loads. */
export function validateNicEnv(): void {
  const nicEnv = process.env.NIC_ENV ?? 'sandbox'
  const nodeEnv = process.env.NODE_ENV ?? 'development'

  if (!VALID_NIC_ENVS.includes(nicEnv as NicEnvKey)) {
    throw new Error(`Invalid NIC_ENV="${nicEnv}". Must be one of: ${VALID_NIC_ENVS.join(', ')}`)
  }

  // MB-5 boot-fail: prod NIC env must only run in production Node
  if (nicEnv === 'prod' && nodeEnv !== 'production') {
    throw new Error(
      `FATAL: NIC_ENV=prod is only allowed when NODE_ENV=production. ` +
      `Current NODE_ENV="${nodeEnv}". This prevents accidental prod NIC calls from dev/staging.`
    )
  }

  const hasIrpCreds = Boolean(process.env.NIC_IRP_USERNAME)
  if (!hasIrpCreds) {
    logger.warn('NIC_STUB_MODE_ACTIVE: NIC_IRP_USERNAME not set — e-invoice running in stub mode')
  } else {
    logger.info('NIC_IRP_CONFIGURED', { env: nicEnv })
  }

  // EWB credentials (optional — stub mode when absent)
  const hasEwbCreds = Boolean(process.env.NIC_EWB_USERNAME)
  if (!hasEwbCreds) {
    logger.warn('NIC_EWB_STUB_MODE_ACTIVE: NIC_EWB_USERNAME not set — e-way bill running in stub mode')
  } else {
    logger.info('NIC_EWB_CONFIGURED', { env: nicEnv })
  }
}

/** Read NIC_ENV safely, defaulting to sandbox. */
export function getNicEnvKey(): NicEnvKey {
  return (process.env.NIC_ENV ?? 'sandbox') as NicEnvKey
}

// ── Notifications — provider env helpers ─────────────────────────────────

/**
 * Returns true when FCM push notifications are configured.
 * FCM requires FIREBASE_SERVICE_ACCOUNT_JSON (base64-encoded service account).
 */
export function isFcmConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
}

/**
 * Returns true when Resend email is configured.
 */
export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)
}

/**
 * Returns true when MSG91 SMS is configured.
 */
export function isMsg91Configured(): boolean {
  return Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_SENDER_ID)
}

/**
 * MSG91 webhook HMAC secret (optional — stub mode when absent).
 * Set MSG91_WEBHOOK_SECRET in .env to enable signature verification.
 * Required in production when MSG91 delivery webhooks are active.
 */
export function getMsg91WebhookSecret(): string | undefined {
  return process.env.MSG91_WEBHOOK_SECRET
}

/**
 * Resend delivery webhook secret (optional — stub mode when absent).
 * Canonical name: RESEND_WEBHOOK_SECRET (P0-3 resolved).
 * Set RESEND_WEBHOOK_SECRET in .env to enable Svix signature verification.
 * Required in production when Resend delivery webhooks are active.
 */
export function getResendWebhookSecret(): string | undefined {
  return process.env.RESEND_WEBHOOK_SECRET
}

// ── Marketing Communications — Phase 5 ────────────────────────────────────

/**
 * Returns true when Aisensy WhatsApp is configured.
 * Required: AISENSY_API_KEY
 */
export function isAisensyConfigured(): boolean {
  return Boolean(process.env.AISENSY_API_KEY)
}

/**
 * Aisensy webhook HMAC secret.
 * Required ≥ 32 chars in production when MARKETING_ENABLED=true.
 */
export function getAisensyWebhookSecret(): string | undefined {
  return process.env.AISENSY_WEBHOOK_SECRET
}

/**
 * MSG91 marketing webhook token (static bearer).
 * Required ≥ 32 chars in production when MARKETING_ENABLED=true.
 */
export function getMsg91MarketingWebhookToken(): string | undefined {
  return process.env.MSG91_MARKETING_WEBHOOK_TOKEN
}

/**
 * Feature flag — set to 'false' to short-circuit all /api/marketing routes.
 */
export function isMarketingEnabled(): boolean {
  return process.env.MARKETING_ENABLED !== 'false'
}

// ── OCR / Anthropic ───────────────────────────────────────────────────────

/**
 * Optional Anthropic API key. When absent, OCR returns OCR_UNAVAILABLE (soft-fail).
 * Set ANTHROPIC_API_KEY in .env to enable receipt OCR.
 */
export function getAnthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY
}

/**
 * Haiku model used for receipt OCR. Override via EXPENSE_OCR_MODEL (e.g. for testing).
 * Default: claude-haiku-4-5-20251001
 */
export function getOcrModel(): string {
  return process.env.EXPENSE_OCR_MODEL ?? 'claude-haiku-4-5-20251001'
}

/**
 * Maximum decoded image size in bytes before OCR is rejected.
 * Default: 5 MiB (5242880 bytes). Override via EXPENSE_OCR_MAX_BYTES.
 */
export function getOcrMaxBytes(): number {
  const raw = parseInt(process.env.EXPENSE_OCR_MAX_BYTES ?? '', 10)
  return isNaN(raw) ? 5_242_880 : raw
}

// ── Audit #5 — Google Drive backup (env-gated opt-in) ─────────────────────
// When isDriveConfigured() is false, all /api/backup/drive/* routes 503.
// getDriveRedirectUri is pinned server-side (never request-derived → no open
// redirect). getDriveTokenEncKey is the AES-256-GCM key; the crypto layer
// validates it decodes to exactly 32 bytes (base64 or hex) and fails closed.

export function isDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
      process.env.GOOGLE_DRIVE_REDIRECT_URI &&
      process.env.GOOGLE_DRIVE_TOKEN_ENC_KEY,
  )
}

export const getDriveClientId = (): string | undefined => process.env.GOOGLE_DRIVE_CLIENT_ID
export const getDriveClientSecret = (): string | undefined => process.env.GOOGLE_DRIVE_CLIENT_SECRET
export const getDriveRedirectUri = (): string | undefined => process.env.GOOGLE_DRIVE_REDIRECT_URI
export const getDriveTokenEncKey = (): string | undefined => process.env.GOOGLE_DRIVE_TOKEN_ENC_KEY

// ── Tenant isolation — scoped-Prisma rollout flag (Wave A, P0.1) ───────────
// Land-dark default is `off`: the scoping $extends layer is NOT attached and the
// app behaves exactly as before. `shadow` attaches it in diff-only mode (#10);
// `enforce` makes it the live client. Read ONCE at boot (M3) — flipping the flag
// requires a restart; there is no half-applied window.

export type ScopedPrismaMode = 'off' | 'shadow' | 'enforce'

/** Parse SCOPED_PRISMA_ENFORCE into a mode. `true` is an alias for `enforce`. */
export function getScopedPrismaMode(): ScopedPrismaMode {
  const raw = (process.env.SCOPED_PRISMA_ENFORCE ?? '').trim().toLowerCase()
  if (raw === 'enforce' || raw === 'true') return 'enforce'
  if (raw === 'shadow') return 'shadow'
  return 'off'
}

/** Shadow-diff sampling rate 0..1 (auto-throttled by the harness under load). Default 1. */
export function getScopedPrismaShadowSample(): number {
  const raw = Number(process.env.SCOPED_PRISMA_SHADOW_SAMPLE)
  if (!Number.isFinite(raw) || raw < 0) return 1
  return raw > 1 ? 1 : raw
}

/**
 * Boot-guard (M3 / Phase-3). Once cutover is declared done
 * (`SCOPED_PRISMA_CUTOVER_DONE=true`), production MUST run with `enforce` — anything
 * else fails to boot so a mis-set flag can never silently drop tenant isolation.
 * Pre-cutover it only rejects a garbage value; land-dark `off` boots fine.
 */
export function validateScopedPrismaBoot(): void {
  const raw = (process.env.SCOPED_PRISMA_ENFORCE ?? '').trim().toLowerCase()
  if (raw && !['off', 'false', 'shadow', 'enforce', 'true'].includes(raw)) {
    throw new Error(`Invalid SCOPED_PRISMA_ENFORCE="${process.env.SCOPED_PRISMA_ENFORCE}". Use off|shadow|enforce.`)
  }
  const cutoverDone = process.env.SCOPED_PRISMA_CUTOVER_DONE === 'true'
  const isProd = (process.env.NODE_ENV ?? 'development') === 'production'
  if (cutoverDone && isProd && getScopedPrismaMode() !== 'enforce') {
    throw new Error(
      'FATAL: SCOPED_PRISMA_CUTOVER_DONE=true but SCOPED_PRISMA_ENFORCE is not enforce. ' +
        'Post-cutover production must run scoped Prisma in enforce mode (tenant isolation).',
    )
  }
}
