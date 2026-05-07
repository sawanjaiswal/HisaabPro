/** Expenses — Recurring Template service (frontend) */

import { api } from '@/lib/api'
import type {
  RecurringTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
} from '../expense.types'

function replayHeaders(): HeadersInit {
  return {
    'X-Request-Nonce': crypto.randomUUID(),
    'X-Request-Timestamp': String(Date.now()),
  }
}

export async function listTemplates(signal?: AbortSignal): Promise<RecurringTemplate[]> {
  return api<RecurringTemplate[]>('/expenses/templates', { signal })
}

export async function createTemplate(
  input: CreateTemplateInput
): Promise<RecurringTemplate> {
  return api<RecurringTemplate>('/expenses/templates', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    entityType: 'recurring-expense',
    entityLabel: input.notes ?? 'Recurring expense',
  })
}

export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput
): Promise<RecurringTemplate> {
  return api<RecurringTemplate>(`/expenses/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    entityType: 'recurring-expense',
    entityLabel: input.notes ?? 'Recurring expense',
  })
}

export async function deleteTemplate(id: string, label: string): Promise<{ deleted: true }> {
  return api<{ deleted: true }>(`/expenses/templates/${id}`, {
    method: 'DELETE',
    headers: replayHeaders(),
    entityType: 'recurring-expense',
    entityLabel: `Delete ${label}`,
  })
}
