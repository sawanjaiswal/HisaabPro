/**
 * Notification Engine — In-App Provider (PR5)
 *
 * Persists a Notification row to the database and fires an SSE event
 * `notification:new` to the target user.
 *
 * Cost: 0 paise. Always configured — no env vars required.
 *
 * SSE broadcast: defensive try/catch. Actual SSE registry is wired in PR9.
 * Until then, the event is a no-op (logged at debug level).
 */

import type { NotificationProvider } from './notification-provider.js'
import type { DispatchResult, NotificationContext, RenderedTemplate } from '../notification-types.js'
import { providerRegistry } from './notification-provider.js'
import { prisma } from '../../../lib/prisma.js'
import logger from '../../../lib/logger.js'

// ---------------------------------------------------------------------------
// SSE registry — forward-declared shape for PR9 wiring
// ---------------------------------------------------------------------------

/** Minimal interface expected from the SSE registry (wired in PR9). */
interface SseRegistry {
  emit(userId: string, event: string, data: unknown): void
}

/** Module-level slot populated by PR9's SSE setup. */
let _sseRegistry: SseRegistry | null = null

/**
 * Called by the SSE setup module (PR9) to inject the live registry.
 * Until PR9 runs, all SSE emits are silent no-ops.
 */
export function setSseRegistry(registry: SseRegistry): void {
  _sseRegistry = registry
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

const inAppProvider: NotificationProvider = {
  name: 'IN_APP',

  isConfigured(): boolean {
    return true
  },

  estimateCostPaise(): number {
    return 0
  },

  async send(ctx: NotificationContext, rendered: RenderedTemplate): Promise<DispatchResult> {
    // Map rendered output to Notification schema fields.
    // The template engine renders one locale; we store it in both language
    // columns so the client can display whichever it prefers without a second
    // render pass. A future PR can render both locales and store separately.
    const titleEn = rendered.title
    const titleHi = rendered.title
    const bodyEn = rendered.body
    const bodyHi = rendered.body

    const notification = await prisma.notification.create({
      data: {
        businessId: ctx.businessId,
        userId: ctx.userId,
        eventKey: ctx.eventKey,
        titleEn,
        titleHi,
        bodyEn,
        bodyHi,
        isRead: false,
        entityType: ctx.entityType ?? null,
        entityId: ctx.entityId ?? null,
        deepLinkUrl: rendered.deepLinkUrl ?? null,
      },
      select: { id: true },
    })

    // Fire SSE event — defensive: SSE registry is wired in PR9.
    try {
      if (_sseRegistry !== null) {
        _sseRegistry.emit(ctx.userId, 'notification:new', {
          notificationId: notification.id,
          businessId: ctx.businessId,
        })
      } else {
        logger.debug('in-app: SSE registry not yet wired (expected until PR9)', {
          userId: ctx.userId,
          notificationId: notification.id,
        })
      }
    } catch (err) {
      // SSE failure must never abort the DB insert — log and continue.
      logger.warn('in-app: SSE emit failed', {
        err,
        userId: ctx.userId,
        notificationId: notification.id,
      })
    }

    return {
      success: true,
      externalId: notification.id,
      costPaise: 0,
      retryable: false,
    }
  },
}

// ---------------------------------------------------------------------------
// Register with the global registry at module load time
// ---------------------------------------------------------------------------

providerRegistry.register('IN_APP', inAppProvider)

export { inAppProvider }
