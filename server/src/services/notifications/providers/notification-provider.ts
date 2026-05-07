/**
 * Notification Engine — Provider Interface + Registry (PR2)
 *
 * This file defines:
 *   1. `NotificationProvider` — the contract every channel driver must satisfy.
 *   2. `ProviderRegistry` — maps ChannelType → provider; queried at dispatch time.
 *   3. `providerRegistry` — module-level singleton; providers register themselves
 *      at boot (PR4–PR5 files call providerRegistry.register(...)).
 *
 * No Prisma calls. No provider implementations. Pure abstraction layer.
 */

import type { ChannelType, DispatchResult, RenderedTemplate, NotificationContext } from '../notification-types.js'

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

/**
 * Contract that every channel driver (FCM, Resend, MSG91, in-app, WhatsApp)
 * must implement.
 */
export interface NotificationProvider {
  /** Stable channel name this provider handles. */
  readonly name: ChannelType

  /**
   * Returns true when all required environment variables are present and
   * the provider is ready to accept send() calls.
   * Checked at boot and at dispatch time before attempting a send.
   */
  isConfigured(): boolean

  /**
   * Returns the estimated send cost in paise (integer).
   * Used by the cost-cap pre-flight check before a job is enqueued.
   * Providers that are free (FCM, in-app) return 0.
   */
  estimateCostPaise(): number

  /**
   * Sends a rendered notification to the recipient resolved from `ctx`.
   * Must NOT embed raw PII in any returned value — see §3.1 of ARCHITECTURE.
   * Recipient resolution (phone, email, FCM token) happens inside this method.
   *
   * @param ctx     Business + user context for recipient resolution and locale.
   * @param rendered Output from the template engine.
   * @returns       DispatchResult with success flag, externalId, costPaise, etc.
   */
  send(ctx: NotificationContext, rendered: RenderedTemplate): Promise<DispatchResult>
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Provider registry — maps each ChannelType to its driver instance.
 * Providers register at module init; dispatch service queries at runtime.
 */
export class ProviderRegistry {
  private readonly providers = new Map<ChannelType, NotificationProvider>()

  /**
   * Registers a provider for the given channel.
   * Calling register() twice for the same channel overwrites the first entry
   * (intended for tests that need to swap implementations).
   */
  register(channel: ChannelType, provider: NotificationProvider): void {
    this.providers.set(channel, provider)
  }

  /**
   * Returns the provider for `channel`.
   * Throws if no provider is registered — callers must guard with isEnabled()
   * before calling get().
   */
  get(channel: ChannelType): NotificationProvider {
    const provider = this.providers.get(channel)
    if (!provider) {
      throw new Error(
        `No provider registered for channel "${channel}". ` +
          'Register one before calling get().',
      )
    }
    return provider
  }

  /**
   * Returns true when a provider is registered AND isConfigured() is true.
   * Dispatch service calls this before enqueuing any job for a channel.
   */
  isEnabled(channel: ChannelType): boolean {
    const provider = this.providers.get(channel)
    return provider !== undefined && provider.isConfigured()
  }
}

// ---------------------------------------------------------------------------
// Module singleton
// ---------------------------------------------------------------------------

/**
 * Application-wide singleton. Provider files (fcm.provider.ts, etc.) call
 * `providerRegistry.register(...)` at module load time so the registry is
 * populated before the first request arrives.
 */
export const providerRegistry = new ProviderRegistry()
