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
