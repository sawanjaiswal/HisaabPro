/** Settings — Document settings API service */

import { api } from '@/lib/api'
import type { DocumentSettings } from '@/features/invoices/invoice-api.types'

export async function getDocumentSettings(signal?: AbortSignal): Promise<DocumentSettings> {
  return api<DocumentSettings>('/settings/documents', { signal, cacheReads: true })
}

export async function updateDocumentSettings(
  data: Partial<DocumentSettings>,
  signal?: AbortSignal,
): Promise<DocumentSettings> {
  return api<DocumentSettings>('/settings/documents', {
    method: 'PUT',
    body: JSON.stringify(data),
    signal,
    entityType: 'document-settings',
    entityLabel: 'Document settings',
  })
}
