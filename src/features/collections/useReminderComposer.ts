/**
 * useReminderComposer — TanStack mutation for bulk reminder dispatch.
 *
 * Follows offline rules: uses api() with entityType + entityLabel.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { TemplateKey } from './reminder-templates'

export interface BulkReminderPayload {
  partyIds: string[]
  channel: 'WHATSAPP' | 'SMS'
  templateKey: TemplateKey
  customMessage?: string
  idempotencyKey: string
}

export interface WaLinkResult {
  partyId: string
  name: string
  waLink: string
}

export interface ExcludedPartyResult {
  partyId: string
  name: string
  reason: 'NO_PHONE' | 'INVALID_PHONE'
}

export interface BulkReminderResult {
  sent: number
  excluded: number
  excludedDetails: ExcludedPartyResult[]
  waLinks: WaLinkResult[]
  bulkBatchId: string
}

export function useReminderComposer() {
  const qc = useQueryClient()

  return useMutation<BulkReminderResult, Error, BulkReminderPayload>({
    mutationFn: async ({ partyIds, channel, templateKey, customMessage, idempotencyKey }) => {
      const resp = await api<{ success: boolean; data: BulkReminderResult }>(
        '/api/payments/reminders/bulk',
        {
          method: 'POST',
          body: JSON.stringify({ partyIds, channel, templateKey, customMessage }),
          entityType: 'reminder_batch',
          entityLabel: `${partyIds.length} parties`,
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      )
      return resp.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['collections'] })
      void qc.invalidateQueries({ queryKey: ['aging'] })
    },
  })
}
