/** Marketing Communications — TypeScript contracts (mirrors server DTOs) */

// ─── Enums ───────────────────────────────────────────────────────────────────

export type MarketingChannel = 'WHATSAPP' | 'SMS'

export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export type ReminderRuleTrigger =
  | 'BIRTHDAY'
  | 'PAYMENT_DUE'
  | 'PAYMENT_OVERDUE'
  | 'FOLLOWUP'
  | 'INACTIVE'
  | 'ORDER_DELIVERY'

export type RecipientDispatchStatus = 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED'

// ─── Segment filter ───────────────────────────────────────────────────────────

export interface SegmentFilter {
  tags?: string[]
  cityContains?: string
  inactiveDays?: number
  outstandingGtePaise?: number
  birthdayThisWeek?: boolean
  partyType?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH'
}

export interface SegmentPreviewResult {
  count: number
  sample: Array<{ id: string; name: string; phone: string | null; hasBirthday: boolean }>
}

// ─── Marketing template ───────────────────────────────────────────────────────

export interface MarketingTemplate {
  id: string
  name: string
  channel: MarketingChannel
  bodyEn: string
  bodyHi: string | null
  dltTemplateId: string | null
  dltRegistered: boolean
  waTemplateName: string | null
  waTemplateStatus: string | null
  variables: string[]
  isActive: boolean
  createdAt: string
}

export interface CreateTemplatePayload {
  name: string
  channel: MarketingChannel
  bodyEn: string
  bodyHi?: string
  dltTemplateId?: string
  waTemplateName?: string
  variables?: string[]
}

export interface UpdateTemplatePayload extends Partial<CreateTemplatePayload> {
  dltRegistered?: boolean
  waTemplateStatus?: string
  isActive?: boolean
}

// ─── Campaign ─────────────────────────────────────────────────────────────────

export interface MarketingCampaign {
  id: string
  name: string
  channel: MarketingChannel
  templateId: string
  segmentFilter: SegmentFilter
  recipientCount: number
  scheduledAt: string | null
  status: CampaignStatus
  sentCount: number
  deliveredCount: number
  failedCount: number
  totalCostPaise: number
  defaultVars: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface CreateCampaignPayload {
  name: string
  channel: MarketingChannel
  templateId: string
  segmentFilter: SegmentFilter
  scheduledAt?: string
  defaultVars?: Record<string, string>
}

export interface CampaignListResponse {
  data: MarketingCampaign[]
  nextCursor: string | null
}

export interface LaunchResponse {
  campaignId: string
  recipientCount: number
  status: CampaignStatus
}

// ─── Campaign recipient ───────────────────────────────────────────────────────

export interface CampaignRecipient {
  id: string
  partyId: string
  partyName: string
  phone: string | null
  status: RecipientDispatchStatus
  skipReason: string | null
  dispatchedAt: string | null
  costPaise: number
}

export interface RecipientListResponse {
  data: CampaignRecipient[]
  nextCursor: string | null
}

// ─── Reminder rule ────────────────────────────────────────────────────────────

export interface ReminderRule {
  id: string
  name: string
  trigger: ReminderRuleTrigger
  offsetDays: number
  channel: MarketingChannel
  templateId: string
  segmentFilter: SegmentFilter
  enabled: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateReminderRulePayload {
  name: string
  trigger: ReminderRuleTrigger
  offsetDays: number
  channel: MarketingChannel
  templateId: string
  segmentFilter?: SegmentFilter
  quietHoursStart?: string
  quietHoursEnd?: string
}

export interface ReminderRuleListResponse {
  data: ReminderRule[]
  nextCursor: string | null
}

// ─── Template list response ───────────────────────────────────────────────────

export interface TemplateListResponse {
  data: MarketingTemplate[]
  nextCursor: string | null
}

// ─── Opt-out ──────────────────────────────────────────────────────────────────

export interface OptOutResponse {
  partyId: string
  marketingOptOut: boolean
  updatedAt: string
}

// ─── Wizard state ─────────────────────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3 | 4 | 5

export interface CampaignWizardState {
  step: WizardStep
  name: string
  channel: MarketingChannel
  templateId: string
  segmentFilter: SegmentFilter
  scheduledAt: string | null
  sendNow: boolean
  idempotencyKey: string
}
