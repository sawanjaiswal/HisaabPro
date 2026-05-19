/**
 * Phase 7 Slice 7.1A — Import service.
 * All transport goes through `api()` so cookie auth + CSRF + replay
 * protection are picked up automatically. Multipart uploads bypass the
 * offline queue (10 MB streams aren't reconstructable from IDB) — see
 * SCOPE Resolved Decisions #14.
 */

import { api } from '@/lib/api'
import { IMPORT_MIN_CLIENT_VERSION } from '../constants/import.constants'
import type { CreateImportRes, ImportFormat, ImportJobView } from '../types/import.types'

export interface UploadImportArgs {
  file: File
  format: ImportFormat
  columnMapping?: Record<string, string>
  /** Unique key per submit attempt — replay-safe via idempotency middleware. */
  idempotencyKey: string
}

export async function uploadImport(args: UploadImportArgs): Promise<CreateImportRes> {
  const { file, format, columnMapping, idempotencyKey } = args
  const form = new FormData()
  form.append('entity', 'parties')
  form.append('format', format)
  form.append('clientVersion', IMPORT_MIN_CLIENT_VERSION)
  if (columnMapping) form.append('columnMapping', JSON.stringify(columnMapping))
  form.append('file', file, file.name)

  return api<CreateImportRes>('/imports', {
    method: 'POST',
    body: form,
    headers: { 'Idempotency-Key': idempotencyKey },
    // Multipart cannot be queued — don't try.
    offlineQueue: false,
    entityType: 'import',
    entityLabel: file.name,
  })
}

export async function getImportJob(jobId: string): Promise<ImportJobView> {
  return api<ImportJobView>(`/imports/${encodeURIComponent(jobId)}`)
}

export async function cancelImportJob(jobId: string): Promise<void> {
  await api<void>(`/imports/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
    offlineQueue: false,
    entityType: 'import',
    entityLabel: 'Cancel import',
  })
}
