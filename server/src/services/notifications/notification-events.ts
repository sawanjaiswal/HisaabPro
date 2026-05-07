/**
 * Notification Engine — Event Catalog (PR3)
 *
 * Exports:
 *   - EVENT_KEYS const object + EventKey union type (18 events)
 *   - EventMeta interface + EVENT_META map (channels, priority, template, optIn)
 *
 * No Prisma calls. Static data only.
 */

import type { ChannelType } from './notification-types.js'

// ---------------------------------------------------------------------------
// Event key registry
// ---------------------------------------------------------------------------

export const EVENT_KEYS = {
  INVOICE_CREATED:             'INVOICE_CREATED',
  INVOICE_SHARED:              'INVOICE_SHARED',
  PAYMENT_RECEIVED:            'PAYMENT_RECEIVED',
  PAYMENT_OVERDUE:             'PAYMENT_OVERDUE',
  PAYMENT_REMINDER:            'PAYMENT_REMINDER',
  PAYMENT_LINK_OPENED:         'PAYMENT_LINK_OPENED',
  PAYMENT_LINK_PAID:           'PAYMENT_LINK_PAID',
  EXPENSE_RECORDED:            'EXPENSE_RECORDED',
  RECURRING_INVOICE_GENERATED: 'RECURRING_INVOICE_GENERATED',
  RECURRING_EXPENSE_PENDING:   'RECURRING_EXPENSE_PENDING',
  LOW_STOCK_ALERT:             'LOW_STOCK_ALERT',
  BATCH_EXPIRY_ALERT:          'BATCH_EXPIRY_ALERT',
  STOCK_OUT:                   'STOCK_OUT',
  PTP_DUE_TODAY:               'PTP_DUE_TODAY',
  PTP_BROKEN:                  'PTP_BROKEN',
  SUBSCRIPTION_EXPIRING_SOON:  'SUBSCRIPTION_EXPIRING_SOON',
  SUBSCRIPTION_EXPIRED:        'SUBSCRIPTION_EXPIRED',
  ADMIN_BROADCAST:             'ADMIN_BROADCAST',
} as const

export type EventKey = (typeof EVENT_KEYS)[keyof typeof EVENT_KEYS]

// ---------------------------------------------------------------------------
// Per-event metadata
// ---------------------------------------------------------------------------

export interface EventMeta {
  /**
   * Default channels enabled for this event (MVP — WHATSAPP excluded).
   * The dispatch service intersects this with user preferences + provider
   * availability at runtime.
   */
  defaultChannels: ChannelType[]
  /** Scheduling / retry priority for the job queue. */
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  /**
   * Template name prefix. Template service resolves full key as:
   *   `${templateName}.${channel.toLowerCase()}`
   * Some events share one template name across channels;
   * others use per-channel names (e.g. payment.overdue.sms vs in_app).
   */
  templateName: string
  /**
   * When true the user must explicitly opt IN to receive this event.
   * When false the channel is enabled by default (user must opt OUT).
   */
  requiresOptIn: boolean
  /**
   * Estimated cost per dispatch in paise (integer).
   * 0 for IN_APP/PUSH events. Used by cost-cap pre-flight.
   * Weighted average when multiple channels fire.
   */
  costEstimatePaise: number
  /**
   * When true the dispatch service requires entityType + entityId in ctx.
   */
  requiresEntity: boolean
}

export const EVENT_META: Record<EventKey, EventMeta> = {
  INVOICE_CREATED: {
    defaultChannels: ['IN_APP'],
    priority: 'MEDIUM',
    templateName: 'invoice.created',
    requiresOptIn: false,
    costEstimatePaise: 0,
    requiresEntity: true,
  },
  INVOICE_SHARED: {
    defaultChannels: ['EMAIL', 'IN_APP'],
    priority: 'HIGH',
    templateName: 'invoice.shared',
    requiresOptIn: false,
    costEstimatePaise: 0,
    requiresEntity: true,
  },
  PAYMENT_RECEIVED: {
    defaultChannels: ['PUSH', 'IN_APP'],
    priority: 'HIGH',
    templateName: 'payment.received',
    requiresOptIn: false,
    costEstimatePaise: 0,
    requiresEntity: true,
  },
  PAYMENT_OVERDUE: {
    defaultChannels: ['SMS', 'IN_APP'],
    priority: 'HIGH',
    templateName: 'payment.overdue',
    requiresOptIn: false,
    costEstimatePaise: 15,
    requiresEntity: true,
  },
  PAYMENT_REMINDER: {
    defaultChannels: ['SMS', 'IN_APP'],
    priority: 'MEDIUM',
    templateName: 'payment.reminder',
    requiresOptIn: false,
    costEstimatePaise: 15,
    requiresEntity: true,
  },
  PAYMENT_LINK_OPENED: {
    defaultChannels: ['IN_APP'],
    priority: 'LOW',
    templateName: 'payment.link.opened',
    requiresOptIn: false,
    costEstimatePaise: 0,
    requiresEntity: true,
  },
  PAYMENT_LINK_PAID: {
    defaultChannels: ['PUSH', 'IN_APP'],
    priority: 'HIGH',
    templateName: 'payment.link.paid',
    requiresOptIn: false,
    costEstimatePaise: 0,
    requiresEntity: true,
  },
  EXPENSE_RECORDED: {
    defaultChannels: ['IN_APP'],
    priority: 'LOW',
    templateName: 'expense.recorded',
    requiresOptIn: false,
    costEstimatePaise: 0,
    requiresEntity: true,
  },
  RECURRING_INVOICE_GENERATED: {
    defaultChannels: ['IN_APP'],
    priority: 'MEDIUM',
    templateName: 'recurring.invoice',
    requiresOptIn: false,
    costEstimatePaise: 0,
    requiresEntity: true,
  },
  RECURRING_EXPENSE_PENDING: {
    defaultChannels: ['PUSH', 'IN_APP'],
    priority: 'MEDIUM',
    templateName: 'recurring.expense',
    requiresOptIn: false,
    costEstimatePaise: 0,
    requiresEntity: true,
  },
  LOW_STOCK_ALERT: {
    defaultChannels: ['PUSH', 'IN_APP'],
    priority: 'MEDIUM',
    templateName: 'stock.low',
    requiresOptIn: false,
    costEstimatePaise: 0,
    requiresEntity: true,
  },
  BATCH_EXPIRY_ALERT: {
    defaultChannels: ['PUSH', 'IN_APP'],
    priority: 'MEDIUM',
    templateName: 'stock.batch_expiry',
    requiresOptIn: false,
    costEstimatePaise: 0,
    requiresEntity: true,
  },
  STOCK_OUT: {
    defaultChannels: ['PUSH', 'IN_APP'],
    priority: 'HIGH',
    templateName: 'stock.out',
    requiresOptIn: false,
    costEstimatePaise: 0,
    requiresEntity: true,
  },
  PTP_DUE_TODAY: {
    defaultChannels: ['SMS', 'IN_APP'],
    priority: 'HIGH',
    templateName: 'ptp.due_today',
    requiresOptIn: false,
    costEstimatePaise: 15,
    requiresEntity: true,
  },
  PTP_BROKEN: {
    defaultChannels: ['IN_APP'],
    priority: 'HIGH',
    templateName: 'ptp.broken',
    requiresOptIn: false,
    costEstimatePaise: 0,
    requiresEntity: true,
  },
  SUBSCRIPTION_EXPIRING_SOON: {
    defaultChannels: ['PUSH', 'EMAIL', 'IN_APP'],
    priority: 'HIGH',
    templateName: 'subscription.expiring',
    requiresOptIn: false,
    costEstimatePaise: 0,
    requiresEntity: false,
  },
  SUBSCRIPTION_EXPIRED: {
    defaultChannels: ['PUSH', 'EMAIL', 'IN_APP'],
    priority: 'HIGH',
    templateName: 'subscription.expired',
    requiresOptIn: false,
    costEstimatePaise: 0,
    requiresEntity: false,
  },
  ADMIN_BROADCAST: {
    defaultChannels: ['PUSH', 'EMAIL', 'IN_APP'],
    priority: 'MEDIUM',
    templateName: 'admin.broadcast',
    requiresOptIn: true,
    costEstimatePaise: 0,
    requiresEntity: false,
  },
}
