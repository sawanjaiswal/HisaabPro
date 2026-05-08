/** Marketing Communications — mutation API service */

import { api } from '@/lib/api'
import type {
  MarketingTemplate,
  CreateTemplatePayload,
  UpdateTemplatePayload,
  MarketingCampaign,
  CreateCampaignPayload,
  LaunchResponse,
  ReminderRule,
  CreateReminderRulePayload,
  OptOutResponse,
} from './marketing.types'

const BASE = '/marketing'

// ─── Templates ────────────────────────────────────────────────────────────────

export async function createTemplate(
  payload: CreateTemplatePayload,
): Promise<MarketingTemplate> {
  return api<MarketingTemplate>(`${BASE}/templates`, {
    method: 'POST',
    body: JSON.stringify(payload),
    entityType: 'marketingTemplate',
    entityLabel: payload.name,
  })
}

export async function updateTemplate(
  id: string,
  name: string,
  payload: UpdateTemplatePayload,
): Promise<MarketingTemplate> {
  return api<MarketingTemplate>(`${BASE}/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    entityType: 'marketingTemplate',
    entityLabel: name,
  })
}

export async function deleteTemplate(
  id: string,
  name: string,
): Promise<void> {
  return api<void>(`${BASE}/templates/${id}`, {
    method: 'DELETE',
    entityType: 'marketingTemplate',
    entityLabel: name,
  })
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export async function createCampaign(
  payload: CreateCampaignPayload,
  idempotencyKey: string,
): Promise<MarketingCampaign> {
  return api<MarketingCampaign>(`${BASE}/campaigns`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'X-Idempotency-Key': idempotencyKey },
    entityType: 'marketingCampaign',
    entityLabel: payload.name,
  })
}

export async function updateCampaign(
  id: string,
  name: string,
  payload: Partial<CreateCampaignPayload>,
): Promise<MarketingCampaign> {
  return api<MarketingCampaign>(`${BASE}/campaigns/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    entityType: 'marketingCampaign',
    entityLabel: name,
  })
}

export async function launchCampaign(
  id: string,
  name: string,
): Promise<LaunchResponse> {
  return api<LaunchResponse>(`${BASE}/campaigns/${id}/launch`, {
    method: 'POST',
    body: JSON.stringify({}),
    entityType: 'marketingCampaign',
    entityLabel: name,
  })
}

export async function cancelCampaign(
  id: string,
  name: string,
): Promise<MarketingCampaign> {
  return api<MarketingCampaign>(`${BASE}/campaigns/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
    entityType: 'marketingCampaign',
    entityLabel: name,
  })
}

// ─── Reminder rules ───────────────────────────────────────────────────────────

export async function createReminderRule(
  payload: CreateReminderRulePayload,
): Promise<ReminderRule> {
  return api<ReminderRule>(`${BASE}/reminder-rules`, {
    method: 'POST',
    body: JSON.stringify(payload),
    entityType: 'reminderRule',
    entityLabel: payload.name,
  })
}

export async function updateReminderRule(
  id: string,
  name: string,
  payload: Partial<CreateReminderRulePayload>,
): Promise<ReminderRule> {
  return api<ReminderRule>(`${BASE}/reminder-rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    entityType: 'reminderRule',
    entityLabel: name,
  })
}

export async function deleteReminderRule(
  id: string,
  name: string,
): Promise<void> {
  return api<void>(`${BASE}/reminder-rules/${id}`, {
    method: 'DELETE',
    entityType: 'reminderRule',
    entityLabel: name,
  })
}

export async function toggleReminderRule(
  id: string,
  name: string,
): Promise<ReminderRule> {
  return api<ReminderRule>(`${BASE}/reminder-rules/${id}/toggle`, {
    method: 'POST',
    body: JSON.stringify({}),
    entityType: 'reminderRule',
    entityLabel: name,
  })
}

// ─── Opt-out ──────────────────────────────────────────────────────────────────

export async function optOutParty(partyId: string, partyName: string): Promise<OptOutResponse> {
  return api<OptOutResponse>(`${BASE}/opt-out/${partyId}`, {
    method: 'POST',
    body: JSON.stringify({}),
    entityType: 'marketingOptOut',
    entityLabel: partyName,
  })
}

export async function optInParty(partyId: string, partyName: string): Promise<OptOutResponse> {
  return api<OptOutResponse>(`${BASE}/opt-out/${partyId}`, {
    method: 'DELETE',
    entityType: 'marketingOptOut',
    entityLabel: partyName,
  })
}
