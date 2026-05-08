/** Marketing Communications — read-side API service */

import { api } from '@/lib/api'
import { MARKETING_PAGE_LIMIT } from './marketing.constants'
import type {
  MarketingTemplate,
  MarketingCampaign,
  CampaignListResponse,
  TemplateListResponse,
  ReminderRuleListResponse,
  ReminderRule,
  RecipientListResponse,
  SegmentPreviewResult,
  SegmentFilter,
  MarketingChannel,
  CampaignStatus,
} from './marketing.types'

const BASE = '/marketing'

// ─── Templates ────────────────────────────────────────────────────────────────

export async function listTemplates(
  channel?: MarketingChannel,
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<TemplateListResponse> {
  const params = new URLSearchParams({ limit: String(MARKETING_PAGE_LIMIT) })
  if (channel) params.set('channel', channel)
  if (cursor) params.set('cursor', cursor)
  return api<TemplateListResponse>(`${BASE}/templates?${params}`, { signal })
}

export async function getTemplate(
  id: string,
  signal?: AbortSignal,
): Promise<MarketingTemplate> {
  return api<MarketingTemplate>(`${BASE}/templates/${id}`, { signal })
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export async function listCampaigns(
  status?: CampaignStatus | '',
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<CampaignListResponse> {
  const params = new URLSearchParams({ limit: String(MARKETING_PAGE_LIMIT) })
  if (status) params.set('status', status)
  if (cursor) params.set('cursor', cursor)
  return api<CampaignListResponse>(`${BASE}/campaigns?${params}`, { signal })
}

export async function getCampaign(
  id: string,
  signal?: AbortSignal,
): Promise<MarketingCampaign> {
  return api<MarketingCampaign>(`${BASE}/campaigns/${id}`, { signal })
}

export async function listCampaignRecipients(
  campaignId: string,
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<RecipientListResponse> {
  const params = new URLSearchParams({ limit: String(MARKETING_PAGE_LIMIT) })
  if (cursor) params.set('cursor', cursor)
  return api<RecipientListResponse>(
    `${BASE}/campaigns/${campaignId}/recipients?${params}`,
    { signal },
  )
}

// ─── Segment preview ──────────────────────────────────────────────────────────

export async function previewSegment(
  filter: SegmentFilter,
  signal?: AbortSignal,
): Promise<SegmentPreviewResult> {
  return api<SegmentPreviewResult>(`${BASE}/segments/preview`, {
    method: 'POST',
    body: JSON.stringify({ filter }),
    signal,
  })
}

// ─── Reminder rules ───────────────────────────────────────────────────────────

export async function listReminderRules(
  enabled?: boolean,
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<ReminderRuleListResponse> {
  const params = new URLSearchParams({ limit: String(MARKETING_PAGE_LIMIT) })
  if (enabled != null) params.set('enabled', String(enabled))
  if (cursor) params.set('cursor', cursor)
  return api<ReminderRuleListResponse>(`${BASE}/reminder-rules?${params}`, { signal })
}

export async function getReminderRule(
  id: string,
  signal?: AbortSignal,
): Promise<ReminderRule> {
  return api<ReminderRule>(`${BASE}/reminder-rules/${id}`, { signal })
}
