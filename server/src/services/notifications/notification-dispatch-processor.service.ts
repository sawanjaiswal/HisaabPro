/**
 * Notification Engine — Dispatch Processor (PR6)
 *
 * processJob(job): claim → resolve provider → send → mark sent/failed → update cost tally
 *
 * Called by the cron drain tick (notification-cron.ts).
 * Separated from orchestrator to keep both files ≤ 250 LOC.
 *
 * Error handling:
 *   - Retryable errors → markFailed() (queue service handles backoff)
 *   - Non-retryable errors → markDead()
 *   - Unexpected throws → markFailed(retryable=true) so job retries
 */

import type { NotificationJob } from '@prisma/client'
import type { NotificationContext } from './notification-types.js'
import { providerRegistry } from './providers/notification-provider.js'
import { markSent, markFailed, markDead } from './notification-queue.service.js'
import { recordSpend } from './notification-cost.service.js'
import { renderTemplate } from './notification-template.service.js'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import type { EventKey } from './notification-events.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JobPayload {
  title?: string
  body?: string
  deepLinkUrl?: string
  entityType?: string
  entityId?: string
}

// ---------------------------------------------------------------------------
// processJob
// ---------------------------------------------------------------------------

export async function processJob(job: NotificationJob): Promise<void> {
  const log = (msg: string, extra?: Record<string, unknown>) =>
    logger.debug(`notification.processor.${msg}`, { jobId: job.id, ...extra })

  try {
    // Resolve provider
    if (!providerRegistry.isEnabled(job.channel)) {
      await markDead(job.id, 'PROVIDER_NOT_ENABLED')
      logger.warn('notification.processor.provider_not_enabled', { jobId: job.id, channel: job.channel })
      return
    }

    const provider = providerRegistry.get(job.channel)

    // Resolve context from job
    const user = await prisma.user.findUnique({
      where: { id: job.userId },
      select: { id: true, phone: true, email: true },
    })

    if (!user) {
      await markDead(job.id, 'INVALID_RECIPIENT')
      logger.warn('notification.processor.user_not_found', { jobId: job.id, userId: job.userId })
      return
    }

    const rawPayload = job.payload as JobPayload

    // Re-render template to ensure freshness (payload already has rendered strings)
    const rendered = renderTemplate(
      job.eventKey as EventKey,
      job.channel,
      'en',
      {
        title: rawPayload.title ?? '',
        body: rawPayload.body ?? '',
      },
    )

    // Build send context
    const ctx: NotificationContext = {
      businessId: job.businessId,
      userId: job.userId,
      eventKey: job.eventKey,
      locale: 'en',
      vars: {
        title: rawPayload.title ?? rendered.title,
        body: rawPayload.body ?? rendered.body,
      },
      entityType: rawPayload.entityType,
      entityId: rawPayload.entityId,
    }

    log('sending', { channel: job.channel, eventKey: job.eventKey })

    // Send via provider
    const result = await provider.send(ctx, rendered)

    if (result.success) {
      await markSent(job.id, result.externalId, result.costPaise)

      // Record spend post-dispatch (idempotent: only on PROCESSING→DISPATCHED)
      if (result.costPaise > 0) {
        await recordSpend(job.businessId, job.channel, result.costPaise)
      }

      log('sent', { externalId: result.externalId, costPaise: result.costPaise })
    } else {
      const errorCode = result.errorCode ?? 'PROVIDER_ERROR'
      await markFailed(job.id, errorCode, result.retryable)
      logger.warn('notification.processor.send_failed', {
        jobId: job.id, errorCode, retryable: result.retryable,
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const errorCode = (err as { code?: string }).code ?? 'UNEXPECTED_ERROR'

    logger.error('notification.processor.unexpected_error', {
      jobId: job.id, error: message,
    })

    // Default to retryable for unknown errors
    await markFailed(job.id, errorCode, true).catch(() => undefined)
  }
}
