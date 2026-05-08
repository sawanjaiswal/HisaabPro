/** Marketing Communications — constants */

import type { CampaignStatus, MarketingChannel, ReminderRuleTrigger } from './marketing.types'

// ─── Routes ───────────────────────────────────────────────────────────────────

export const MARKETING_ROUTES = {
  HUB:               '/marketing',
  CAMPAIGNS:         '/marketing/campaigns',
  CAMPAIGN_NEW:      '/marketing/campaigns/new',
  CAMPAIGN_DETAIL:   '/marketing/campaigns/:id',
  TEMPLATES:         '/marketing/templates',
  TEMPLATE_NEW:      '/marketing/templates/new',
  TEMPLATE_EDIT:     '/marketing/templates/:id/edit',
  REMINDERS:         '/marketing/reminders',
  REMINDER_NEW:      '/marketing/reminders/new',
  REMINDER_EDIT:     '/marketing/reminders/:id/edit',
  OPT_OUTS:          '/marketing/opt-outs',
} as const

// ─── Campaign status ──────────────────────────────────────────────────────────

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT:     'Draft',
  SCHEDULED: 'Scheduled',
  RUNNING:   'Running',
  COMPLETED: 'Completed',
  FAILED:    'Failed',
  CANCELLED: 'Cancelled',
}

export const CAMPAIGN_STATUS_BADGE: Record<CampaignStatus, string> = {
  DRAFT:     'badge badge--neutral',
  SCHEDULED: 'badge badge--info',
  RUNNING:   'badge badge--warning',
  COMPLETED: 'badge badge--success',
  FAILED:    'badge badge--error',
  CANCELLED: 'badge badge--neutral',
}

// ─── Channel labels ───────────────────────────────────────────────────────────

export const CHANNEL_LABEL: Record<MarketingChannel, string> = {
  WHATSAPP: 'WhatsApp',
  SMS:      'SMS',
}

export const CHANNEL_COLOR: Record<MarketingChannel, string> = {
  WHATSAPP: 'var(--color-success-600)',
  SMS:      'var(--color-primary-600)',
}

// ─── Reminder trigger ─────────────────────────────────────────────────────────

export const TRIGGER_LABEL: Record<ReminderRuleTrigger, string> = {
  BIRTHDAY:         'Birthday Wish',
  PAYMENT_DUE:      'Payment Due',
  PAYMENT_OVERDUE:  'Payment Overdue',
  FOLLOWUP:         'Follow-Up',
  INACTIVE:         'Inactive Customer',
}

export const TRIGGER_BADGE: Record<ReminderRuleTrigger, string> = {
  BIRTHDAY:         'badge badge--info',
  PAYMENT_DUE:      'badge badge--warning',
  PAYMENT_OVERDUE:  'badge badge--error',
  FOLLOWUP:         'badge badge--neutral',
  INACTIVE:         'badge badge--neutral',
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export const MARKETING_PAGE_LIMIT = 20
export const SEGMENT_PREVIEW_DEBOUNCE_MS = 400

// ─── Cost estimates (paise) ───────────────────────────────────────────────────

export const COST_PER_WA_PAISE  = 50
export const COST_PER_SMS_PAISE = 25

// ─── Quiet hours ──────────────────────────────────────────────────────────────

export const QUIET_HOURS_START = '21:00'
export const QUIET_HOURS_END   = '09:00'

// ─── Wizard steps ─────────────────────────────────────────────────────────────

export const WIZARD_STEP_LABELS = [
  'Name & Channel',
  'Template',
  'Audience',
  'Schedule',
  'Preview',
] as const
