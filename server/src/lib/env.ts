/**
 * Env accessor barrel — the single import surface for server env config.
 *
 * Split from a 292-line monolith (enforce.js, max 250 lines). Domain modules
 * are siblings: env.<domain>.ts. Import from THIS file, not from a sibling
 * directly, so the import surface stays one grep away.
 *
 * Types use `export type` — required by tsconfig `isolatedModules: true`.
 * Specifiers keep `.js` — the server runs as real Node ESM ("type": "module"),
 * so an extensionless specifier typechecks clean under `moduleResolution:
 * bundler` and then fails at boot.
 *
 * Named lists, never `export * from` — a star re-export hides a dropped symbol
 * from review and silently widens the surface when a sibling adds an export.
 */

export {
  getEntitlementPrivateKey,
  getEntitlementPublicKey,
  getEntitlementKeyPrev,
} from './env.entitlement.js'

export {
  getRazorpayPlanProMax,
  getRazorpayPlanId,
  getOverflowGraceDays,
  getSubscriptionGraceDays,
} from './env.billing.js'
export type { RazorpayPlanResolution } from './env.billing.js'

export { validateNicEnv, getNicEnvKey } from './env.nic.js'
export type { NicEnvKey } from './env.nic.js'

export {
  isFcmConfigured,
  isResendConfigured,
  isMsg91Configured,
  getMsg91WebhookSecret,
  getResendWebhookSecret,
} from './env.notifications.js'

export {
  isAisensyConfigured,
  getAisensyWebhookSecret,
  getMsg91MarketingWebhookToken,
  isMarketingEnabled,
} from './env.marketing.js'

export { getAnthropicApiKey, getOcrModel, getOcrMaxBytes } from './env.ocr.js'

export {
  isDriveConfigured,
  getDriveClientId,
  getDriveClientSecret,
  getDriveRedirectUri,
  getDriveTokenEncKey,
} from './env.drive.js'

export {
  getScopedPrismaMode,
  getScopedPrismaShadowSample,
  validateScopedPrismaBoot,
} from './env.scoped-prisma.js'
export type { ScopedPrismaMode } from './env.scoped-prisma.js'
