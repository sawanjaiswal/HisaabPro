/**
 * Notification Engine — WhatsApp Provider STUB (PR5)
 *
 * WhatsApp deferred — wire real provider in future PR.
 *
 * This file exists so the import path is stable and a future PR can flip
 * `isConfigured()` to return true and replace `send()` with a real
 * Aisensy / Meta Cloud API implementation.
 *
 * Current behaviour:
 *   - `isConfigured()` returns false → dispatch service will never attempt
 *     to enqueue a WHATSAPP job (guarded by `providerRegistry.isEnabled()`).
 *   - `send()` throws `NotRegisteredError` as a hard backstop in case the
 *     dispatch service guard is bypassed (e.g. in tests or future code paths).
 *   - This provider is intentionally NOT registered with `providerRegistry`
 *     because `isConfigured()` returns false and the registry would reject it
 *     as disabled anyway. Registering it here would make `isEnabled()` return
 *     false for WHATSAPP rather than throwing "no provider" — both outcomes
 *     are safe. Re-enable the register() call when real integration is wired.
 */

import type { NotificationProvider } from './notification-provider.js'
import type { DispatchResult, NotificationContext, RenderedTemplate } from '../notification-types.js'
import { NotRegisteredError } from '../notification-errors.js'

const whatsappProvider: NotificationProvider = {
  name: 'WHATSAPP',

  isConfigured(): boolean {
    // Returns false until Aisensy / Meta Cloud API integration is wired.
    return false
  },

  estimateCostPaise(): number {
    // Placeholder — actual cost will depend on message type (session vs template).
    return 0
  },

  async send(_ctx: NotificationContext, _rendered: RenderedTemplate): Promise<DispatchResult> {
    throw new NotRegisteredError(
      'WhatsApp provider is not configured. ' +
        'Wire real Aisensy / Meta Cloud API integration before enabling this channel.',
    )
  },
}

// NOTE: Not registered with providerRegistry — intentional.
// isConfigured() returns false; registering would add a disabled entry.
// Uncomment the line below when real integration is ready:
//   providerRegistry.register('WHATSAPP', whatsappProvider)

export { whatsappProvider }
