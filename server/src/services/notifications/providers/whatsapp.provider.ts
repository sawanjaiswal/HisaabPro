/**
 * Notification Engine — WhatsApp Provider (Aisensy) (PR6)
 *
 * Real implementation: POSTs to Aisensy Campaign API v2.
 * Degrades gracefully when AISENSY_API_KEY is absent (dev stub).
 *
 * Provider registers itself with providerRegistry when isConfigured() = true.
 * When unconfigured: campaigns mark all recipients SKIPPED with
 * skipReason: 'provider_not_configured'. Campaign transitions to COMPLETED.
 */

import type { NotificationProvider } from './notification-provider.js'
import type { DispatchResult, NotificationContext, RenderedTemplate } from '../notification-types.js'
import { NotificationErrorCode } from '../notification-errors.js'
import { providerRegistry } from './notification-provider.js'
import logger from '../../../lib/logger.js'

const AISENSY_SEND_URL = 'https://backend.aisensy.com/campaign/t1/api/v2'

interface AisensyResponse {
  status?: string
  messageId?: string
  message?: string
}

const whatsappProvider: NotificationProvider = {
  name: 'WHATSAPP',

  isConfigured(): boolean {
    return Boolean(process.env.AISENSY_API_KEY)
  },

  estimateCostPaise(): number {
    return 50 // Template message cost
  },

  async send(ctx: NotificationContext, rendered: RenderedTemplate): Promise<DispatchResult> {
    const apiKey = process.env.AISENSY_API_KEY
    if (!apiKey) {
      return {
        success: false,
        costPaise: 0,
        errorCode: NotificationErrorCode.PROVIDER_DOWN,
        errorMessage: 'AISENSY_API_KEY not configured',
        retryable: false,
      }
    }

    const waTemplateName = (rendered.payload as Record<string, unknown>).waTemplateName as string | undefined
    if (!waTemplateName) {
      return {
        success: false,
        costPaise: 0,
        errorCode: NotificationErrorCode.INVALID_RECIPIENT,
        errorMessage: 'waTemplateName required for Aisensy send',
        retryable: false,
      }
    }

    // Resolve phone from party — ctx.userId is partyId for marketing sends
    const { prisma } = await import('../../../lib/prisma.js')
    const party = await prisma.party.findUnique({
      where: { id: ctx.userId },
      select: { phone: true, name: true },
    })

    if (!party?.phone) {
      return {
        success: false,
        costPaise: 0,
        errorCode: NotificationErrorCode.INVALID_RECIPIENT,
        errorMessage: 'Party has no phone number',
        retryable: false,
      }
    }

    const payload = {
      apiKey,
      campaignName: waTemplateName,
      destination: party.phone.replace(/\D/g, ''), // digits only
      userName: party.name ?? 'Customer',
      templateParams: Object.values(ctx.vars ?? {}).map(String),
      source: 'HisaabPro',
    }

    try {
      const resp = await fetch(AISENSY_SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      })

      const raw = await resp.text()
      let parsed: AisensyResponse = {}
      try { parsed = JSON.parse(raw) as AisensyResponse } catch { /* non-JSON ok */ }

      if (!resp.ok) {
        logger.warn('aisensy.send.http_error', { status: resp.status, userId: ctx.userId })
        return {
          success: false,
          costPaise: 0,
          errorCode: resp.status >= 500 ? NotificationErrorCode.PROVIDER_DOWN : NotificationErrorCode.INVALID_RECIPIENT,
          errorMessage: parsed.message ?? raw,
          retryable: resp.status >= 500,
        }
      }

      logger.info('aisensy.send.success', { userId: ctx.userId, messageId: parsed.messageId })
      return { success: true, externalId: parsed.messageId, costPaise: 50, retryable: false }
    } catch (err) {
      logger.warn('aisensy.send.exception', { userId: ctx.userId, error: String(err) })
      return {
        success: false,
        costPaise: 0,
        errorCode: NotificationErrorCode.PROVIDER_DOWN,
        errorMessage: String(err),
        retryable: true,
      }
    }
  },
}

// Register only when configured
if (whatsappProvider.isConfigured()) {
  providerRegistry.register('WHATSAPP', whatsappProvider)
}

export { whatsappProvider }
