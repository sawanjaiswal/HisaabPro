/**
 * Marketing Compliance Service (PR4)
 * Gates: DLT guard, opt-out filter, quiet-hours wrapper.
 * Three gates in fixed order — per ARCHITECTURE §7.
 */

import { prisma } from '../../lib/prisma.js'
import { computeScheduledAt } from '../notifications/notification-quiet-hours.service.js'
import logger from '../../lib/logger.js'
import type { ReminderConfig } from '@prisma/client'

// ---------------------------------------------------------------------------
// Gate 1 — DLT/WA approval check
// ---------------------------------------------------------------------------

export interface TemplateReadyResult {
  ready: boolean
  errorCode?: string
  message?: string
}

export function assertTemplateReady(
  template: {
    channel: string
    dltTemplateId: string | null
    waTemplateName: string | null
    waTemplateStatus: string | null
  },
): TemplateReadyResult {
  if (template.channel === 'SMS') {
    if (!template.dltTemplateId) {
      return { ready: false, errorCode: 'TEMPLATE_DLT_MISSING', message: 'DLT Template ID is required for SMS campaigns' }
    }
  }

  if (template.channel === 'WHATSAPP') {
    if (!template.waTemplateName) {
      return { ready: false, errorCode: 'TEMPLATE_WA_NAME_MISSING', message: 'WhatsApp template name is required' }
    }
    if (template.waTemplateStatus !== 'APPROVED') {
      return { ready: false, errorCode: 'TEMPLATE_WA_NOT_APPROVED', message: 'WhatsApp template must be APPROVED before launch' }
    }
  }

  return { ready: true }
}

// ---------------------------------------------------------------------------
// Gate 2 — Drop opted-out parties
// ---------------------------------------------------------------------------

export async function dropOptedOut(partyIds: string[]): Promise<Set<string>> {
  if (partyIds.length === 0) return new Set()

  const optedOut = await prisma.party.findMany({
    where: { id: { in: partyIds }, marketingOptOut: true },
    select: { id: true },
  })

  const optedOutSet = new Set(optedOut.map((p) => p.id))
  const eligible = new Set(partyIds.filter((id) => !optedOutSet.has(id)))

  if (optedOutSet.size > 0) {
    logger.debug('marketing.compliance.dropped_opted_out', { count: optedOutSet.size })
  }

  return eligible
}

// ---------------------------------------------------------------------------
// Gate 3 — Quiet hours wrapper
// ---------------------------------------------------------------------------

export function applyQuietHours(
  baseDate: Date,
  quietStart?: string | null,
  quietEnd?: string | null,
  reminderConfig?: ReminderConfig | null,
): Date {
  const quietHoursStart = quietStart ?? reminderConfig?.quietHoursStart ?? '21:00'
  const quietHoursEnd = quietEnd ?? reminderConfig?.quietHoursEnd ?? '09:00'
  return computeScheduledAt(baseDate, { quietHoursStart, quietHoursEnd })
}
