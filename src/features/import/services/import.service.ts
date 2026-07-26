/**
 * Phase 7 Slice 7.1A — Import service.
 * All transport goes through `api()` so cookie auth + CSRF + replay
 * protection are picked up automatically. Multipart uploads bypass the
 * offline queue (10 MB streams aren't reconstructable from IDB) — see
 * SCOPE Resolved Decisions #14.
 */

import { api } from '@/lib/api'
import { API_URL } from '@/config/app.config'
import { IMPORT_MIN_CLIENT_VERSION } from '../constants/import.constants'
import type {
  CommitImportReq,
  CommitImportRes,
  CreateImportRes,
  ImportEntity,
  ImportFormat,
  ImportJobView,
} from '../types/import.types'

/**
 * Every /imports route sits behind `requireMinClientVersion` and reads the
 * `X-Client-Version` HEADER (require-min-client-version.ts:43). In production
 * a missing header is a hard 426 — so this is not optional decoration, it is
 * the price of entry to the whole import API. It is the import contract's
 * version, deliberately NOT `APP_VERSION`: the gate asks "does this client
 * implement the 7.1 import protocol", which is exactly what the constant
 * mirrored from server/src/constants/import.constants.ts means.
 */
function importHeaders(extra?: Record<string, string>): Record<string, string> {
  return { 'X-Client-Version': IMPORT_MIN_CLIENT_VERSION, ...extra }
}

export interface UploadImportArgs {
  file: File
  format: ImportFormat
  /** 7.1B: which kind of records the file carries. Defaults to 'parties'. */
  entity?: ImportEntity
  columnMapping?: Record<string, string>
  /** Unique key per submit attempt — replay-safe via idempotency middleware. */
  idempotencyKey: string
}

export async function uploadImport(args: UploadImportArgs): Promise<CreateImportRes> {
  const { file, format, entity = 'parties', columnMapping, idempotencyKey } = args
  const form = new FormData()
  form.append('entity', entity)
  form.append('format', format)
  if (columnMapping) form.append('columnMapping', JSON.stringify(columnMapping))
  form.append('file', file, file.name)

  return api<CreateImportRes>('/imports', {
    method: 'POST',
    body: form,
    headers: importHeaders({ 'X-Idempotency-Key': idempotencyKey }),
    // Multipart cannot be queued — don't try.
    offlineQueue: false,
    entityType: 'import',
    entityLabel: entityLabelFor(entity, file.name),
  })
}

function entityLabelFor(entity: ImportEntity, fileName: string): string {
  switch (entity) {
    case 'product': return `Products: ${fileName}`
    case 'invoice': return `Invoices: ${fileName}`
    case 'payments': return `Payments: ${fileName}`
    case 'parties':
    default: return `Parties: ${fileName}`
  }
}

export interface GetImportJobOptions {
  /** Opaque cursor returned by a previous page's `nextCursor`. */
  cursor?: string | null
  /** Page size (server caps at 100). */
  limit?: number
}

export async function getImportJob(
  jobId: string,
  opts: GetImportJobOptions = {},
): Promise<ImportJobView> {
  const params = new URLSearchParams()
  if (opts.cursor) params.set('cursor', opts.cursor)
  if (opts.limit) params.set('limit', String(opts.limit))
  const qs = params.toString()
  const suffix = qs ? `?${qs}` : ''
  return api<ImportJobView>(`/imports/${encodeURIComponent(jobId)}${suffix}`, {
    headers: importHeaders(),
  })
}

export async function cancelImportJob(jobId: string): Promise<void> {
  await api<void>(`/imports/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: importHeaders(),
    offlineQueue: false,
    entityType: 'import',
    entityLabel: 'Cancel import',
  })
}

/**
 * POST /api/imports/:id/commit.
 *
 * BE requires `X-Idempotency-Key` HEADER (not body) and `commitToken` in body.
 * Online-only — multipart-style upload, but more importantly the bind in
 * BE M3 ties (businessId,userId,jobId,idempotencyKey) so re-queuing after
 * an offline window would collide with subsequent legitimate retries.
 */
export async function commitImportJob(
  jobId: string,
  body: CommitImportReq,
): Promise<CommitImportRes> {
  const { idempotencyKey, ...payload } = body
  return api<CommitImportRes>(`/imports/${encodeURIComponent(jobId)}/commit`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: importHeaders({ 'X-Idempotency-Key': idempotencyKey }),
    offlineQueue: false,
    entityType: 'import',
    entityLabel: `Commit import ${jobId}`,
  })
}

/**
 * Trigger the browser to download the error CSV. Auth is cookie-based
 * (same-origin httpOnly access cookie), so `window.location.href` sends
 * credentials automatically and the BE's Content-Disposition header
 * makes the browser save the file. The route returns text/csv — the
 * JSON-envelope `api()` wrapper cannot consume it.
 */
export function downloadErrorCsv(jobId: string): void {
  if (typeof window === 'undefined') return
  const url = `${API_URL}/imports/${encodeURIComponent(jobId)}/error-csv`
  window.location.href = url
}
