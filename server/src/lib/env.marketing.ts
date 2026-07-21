/**
 * Marketing Communications — Phase 5 env helpers.
 */

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
