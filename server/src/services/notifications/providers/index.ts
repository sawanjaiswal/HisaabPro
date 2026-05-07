/**
 * Notification Engine — Provider barrel (PR4)
 *
 * Importing this file triggers all provider modules to load and register
 * themselves with `providerRegistry` (if their env vars are present).
 *
 * Import order is intentional: PR4 providers first (FCM, Resend, MSG91),
 * then PR5 providers (in-app, WhatsApp) when added.
 *
 * Usage:
 *   import '@/services/notifications/providers'
 *   // providerRegistry is now populated for all configured channels
 */

export { fcmProvider } from './fcm.provider.js'
export { resendProvider } from './resend.provider.js'
export { msg91Provider } from './msg91.provider.js'
// PR5 providers
export { inAppProvider, setSseRegistry } from './in-app.provider.js'
export { whatsappProvider } from './whatsapp.provider.js'
export { providerRegistry } from './notification-provider.js'
