/**
 * Notification Engine — Dispatch Orchestrator (PR6)
 *
 * notify(eventKey, ctx) — public entry point.
 * NEVER throws to caller: all errors are swallowed + logged.
 *
 * Flow for each channel:
 *   1. Load user preferences
 *   2. Skip if pref.enabled === false (opt-out)
 *   3. Skip IN_APP rate-limit + cost-cap checks
 *   4. Rate-limit check for external channels
 *   5. Cost-cap pre-flight check
 *   6. Quiet-hours scheduling (external channels only)
 *   7. Render template
 *   8. Build recipientHash (sha256, no raw PII in payload)
 *   9. Enqueue job (dedupe within 60s window handled by queue service)
 *
 * Returns { enqueued, skipped } summary.
 * See notification-dispatch-processor.service.ts for processJob().
 */

import { createHash } from 'node:crypto'
import type { NotificationChannel } from '@prisma/client'
import type { NotificationContext } from './notification-types.js'
import { EVENT_META } from './notification-events.js'
import type { EventKey } from './notification-events.js'
import { getPreferences, isChannelEnabled } from './notification-preference.service.js'
import { checkRateLimit } from './notification-rate-limit.service.js'
import { checkCap, getPlanTier } from './notification-cost.service.js'
import { computeScheduledAt } from './notification-quiet-hours.service.js'
import { enqueue } from './notification-queue.service.js'
import { renderTemplate } from './notification-template.service.js'
import { providerRegistry } from './providers/notification-provider.js'
import logger from '../../lib/logger.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkippedChannel {
  channel: NotificationChannel
  reason: string
}

export interface NotifyResult {
  enqueued: number
  skipped: SkippedChannel[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashRecipient(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

const EXTERNAL_CHANNELS: NotificationChannel[] = ['PUSH', 'EMAIL', 'SMS', 'WHATSAPP']

// ---------------------------------------------------------------------------
// notify — main orchestrator
// ---------------------------------------------------------------------------

export async function notify(
  eventKey: EventKey,
  ctx: NotificationContext,
): Promise<NotifyResult> {
  const result: NotifyResult = { enqueued: 0, skipped: [] }

  try {
    const meta = EVENT_META[eventKey]
    if (!meta) {
      logger.warn('notification.dispatch.unknown_event', { eventKey })
      return result
    }

    const { prefs, quietHours } = await getPreferences(ctx.businessId, ctx.userId)
    const planTier = await getPlanTier(ctx.businessId)

    for (const channel of meta.defaultChannels) {
      try {
        // Skip if provider not enabled (e.g. WHATSAPP stub)
        if (!providerRegistry.isEnabled(channel)) {
          result.skipped.push({ channel, reason: 'provider_not_enabled' })
          continue
        }

        // Skip if user opted out
        if (!isChannelEnabled(prefs, eventKey, channel)) {
          result.skipped.push({ channel, reason: 'opted_out' })
          continue
        }

        const isExternal = EXTERNAL_CHANNELS.includes(channel)

        // Rate-limit check for external channels
        if (isExternal) {
          const rl = await checkRateLimit(ctx.userId, channel)
          if (!rl.allowed) {
            result.skipped.push({ channel, reason: 'rate_limited' })
            logger.warn('notification.dispatch.rate_limited', { userId: ctx.userId, channel })
            continue
          }
        }

        // Cost-cap pre-flight for external channels
        const provider = providerRegistry.get(channel)
        const estCost = provider.estimateCostPaise()

        if (isExternal && estCost > 0) {
          const costCheck = await checkCap(ctx.businessId, planTier, channel, estCost)
          if (!costCheck.allowed) {
            result.skipped.push({ channel, reason: 'cost_cap_exceeded' })
            continue
          }
        }

        // Quiet hours — IN_APP fires immediately
        const scheduledAt = channel === 'IN_APP'
          ? new Date()
          : computeScheduledAt(new Date(), quietHours)

        // Render template
        const rendered = renderTemplate(
          eventKey,
          channel,
          ctx.locale ?? 'en',
          ctx.vars,
        )

        // Build recipientHash — sha256 of userId (raw PII never in payload)
        const recipientHash = hashRecipient(ctx.userId)

        // Enqueue
        const { jobId, skipped: deduped } = await enqueue({
          businessId: ctx.businessId,
          userId: ctx.userId,
          eventKey,
          channel,
          payload: {
            title: rendered.title,
            body: rendered.body,
            deepLinkUrl: rendered.deepLinkUrl,
            entityType: ctx.entityType,
            entityId: ctx.entityId,
          },
          recipientHash,
          scheduledAt,
        })

        if (deduped) {
          result.skipped.push({ channel, reason: 'deduplicated' })
        } else {
          result.enqueued++
          logger.debug('notification.dispatch.enqueued', { jobId, channel, eventKey })
        }
      } catch (channelErr) {
        logger.error('notification.dispatch.channel_error', {
          eventKey, channel, userId: ctx.userId,
          error: channelErr instanceof Error ? channelErr.message : String(channelErr),
        })
        result.skipped.push({ channel, reason: 'internal_error' })
      }
    }
  } catch (err) {
    logger.error('notification.dispatch.fatal', {
      eventKey, userId: ctx.userId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return result
}
