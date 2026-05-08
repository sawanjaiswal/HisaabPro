/**
 * Notification Engine — Marketing Event Catalog extension (PR2 Phase 5)
 * Exports marketing-specific EVENT_KEYS and EVENT_META entries.
 * Merged into the main registry via notification-events.ts.
 */

import type { EventMeta } from './notification-events.js'

export const MARKETING_EVENT_KEYS = {
  MARKETING_CAMPAIGN_WHATSAPP:   'MARKETING_CAMPAIGN_WHATSAPP',
  MARKETING_CAMPAIGN_SMS:        'MARKETING_CAMPAIGN_SMS',
  REMINDER_BIRTHDAY:             'REMINDER_BIRTHDAY',
  REMINDER_PAYMENT_DUE:          'REMINDER_PAYMENT_DUE',
  REMINDER_PAYMENT_OVERDUE_AUTO: 'REMINDER_PAYMENT_OVERDUE_AUTO',
  REMINDER_FOLLOWUP:             'REMINDER_FOLLOWUP',
  REMINDER_INACTIVE:             'REMINDER_INACTIVE',
} as const

export type MarketingEventKey = (typeof MARKETING_EVENT_KEYS)[keyof typeof MARKETING_EVENT_KEYS]

export const MARKETING_EVENT_META: Record<MarketingEventKey, EventMeta> = {
  MARKETING_CAMPAIGN_WHATSAPP: {
    defaultChannels: ['WHATSAPP'],
    priority: 'MEDIUM',
    templateName: 'marketing.campaign.whatsapp',
    requiresOptIn: true,
    costEstimatePaise: 50,
    requiresEntity: true,
  },
  MARKETING_CAMPAIGN_SMS: {
    defaultChannels: ['SMS'],
    priority: 'MEDIUM',
    templateName: 'marketing.campaign.sms',
    requiresOptIn: true,
    costEstimatePaise: 25,
    requiresEntity: true,
  },
  REMINDER_BIRTHDAY: {
    defaultChannels: ['WHATSAPP', 'SMS'],
    priority: 'LOW',
    templateName: 'reminder.birthday',
    requiresOptIn: true,
    costEstimatePaise: 50,
    requiresEntity: true,
  },
  REMINDER_PAYMENT_DUE: {
    defaultChannels: ['WHATSAPP', 'SMS'],
    priority: 'HIGH',
    templateName: 'reminder.payment_due',
    requiresOptIn: false,
    costEstimatePaise: 50,
    requiresEntity: true,
  },
  REMINDER_PAYMENT_OVERDUE_AUTO: {
    defaultChannels: ['SMS'],
    priority: 'HIGH',
    templateName: 'reminder.payment_overdue_auto',
    requiresOptIn: false,
    costEstimatePaise: 25,
    requiresEntity: true,
  },
  REMINDER_FOLLOWUP: {
    defaultChannels: ['WHATSAPP', 'SMS'],
    priority: 'LOW',
    templateName: 'reminder.followup',
    requiresOptIn: true,
    costEstimatePaise: 50,
    requiresEntity: true,
  },
  REMINDER_INACTIVE: {
    defaultChannels: ['SMS'],
    priority: 'LOW',
    templateName: 'reminder.inactive',
    requiresOptIn: true,
    costEstimatePaise: 25,
    requiresEntity: true,
  },
}
