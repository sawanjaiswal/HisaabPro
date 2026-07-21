/**
 * Notifications — provider env helpers (FCM push, Resend email, MSG91 SMS).
 */

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
