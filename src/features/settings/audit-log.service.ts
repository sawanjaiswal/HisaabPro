/** Audit Log — Phase 6 PR4 API service layer
 *
 * Server: server/src/routes/audit.routes.ts
 *   GET    /audit                — cursor-paginated search
 *   GET    /audit/redactions     — list redactions
 *   POST   /audit/redactions     — upsert (entityType + fieldPath unique)
 *   DELETE /audit/redactions/:id — disable (server soft-disables)
 *   POST   /audit/export         — CSV blob download
 *
 * All endpoints are PinGated server-side (read-only routeClass for GETs,
 * mutation routeClass for POSTs). The `api()` helper's 403 PIN_REQUIRED
 * interceptor opens PinPadSheet and retries — no special handling needed
 * here.
 *
 * `api()` already prepends API_URL, so paths begin with /.
 */

import { api, ApiError } from '@/lib/api'
import { AUDIT_PAGE_SIZE } from './audit.constants'
import type {
  AuditSearchFilters,
  AuditSearchResponse,
  Redaction,
  RedactionListResponse,
  RedactionUpsertInput,
} from './audit.types'

// ─── Query builder ────────────────────────────────────────────────────────────

/**
 * Builds a URL search-params string for /audit. Only appends params with
 * defined non-empty values so the BE sees omitted filters as `undefined`.
 *
 * IMPORTANT: this MUST NOT escape, normalize, or strip the `q` value. The
 * BE uses websearch_to_tsquery which already tolerates the full PR4 fuzz
 * battery — any FE-side mangling would defeat that hardening.
 */
export function buildAuditSearchQuery(
  filters: AuditSearchFilters,
  cursor: string | null,
  limit: number = AUDIT_PAGE_SIZE,
): string {
  const params = new URLSearchParams()
  const { q, entityType, action, userId, dateFrom, dateTo } = filters
  if (q !== undefined && q !== '') params.set('q', q)
  if (entityType !== undefined && entityType !== '') params.set('entityType', entityType)
  if (action !== undefined) params.set('action', action)
  if (userId !== undefined && userId !== '') params.set('userId', userId)
  if (dateFrom !== undefined && dateFrom !== '') params.set('dateFrom', dateFrom)
  if (dateTo !== undefined && dateTo !== '') params.set('dateTo', dateTo)
  if (cursor !== null && cursor !== '') params.set('cursor', cursor)
  params.set('limit', String(limit))
  return params.toString()
}

// ─── Audit search ─────────────────────────────────────────────────────────────

/** Fetch one page of audit rows. nextCursor is opaque — pass back verbatim. */
export async function searchAuditLog(
  filters: AuditSearchFilters,
  cursor: string | null,
  limit: number = AUDIT_PAGE_SIZE,
  signal?: AbortSignal,
): Promise<AuditSearchResponse> {
  const qs = buildAuditSearchQuery(filters, cursor, limit)
  return api<AuditSearchResponse>(`/audit?${qs}`, { signal })
}

// ─── Redactions ───────────────────────────────────────────────────────────────

export async function listRedactions(
  signal?: AbortSignal,
): Promise<RedactionListResponse> {
  return api<RedactionListResponse>(`/audit/redactions`, { signal })
}

export async function upsertRedaction(
  input: RedactionUpsertInput,
): Promise<{ redaction: Redaction }> {
  return api<{ redaction: Redaction }>(`/audit/redactions`, {
    method: 'POST',
    body: JSON.stringify(input),
    entityType: 'redaction',
    entityLabel: `${input.entityType}.${input.fieldPath}`,
  })
}

export async function disableRedaction(
  id: string,
  label?: string,
): Promise<{ redaction: Redaction }> {
  return api<{ redaction: Redaction }>(`/audit/redactions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    entityType: 'redaction',
    entityLabel: label ?? id,
  })
}

// ─── CSV export (binary; cannot use api() JSON helper) ───────────────────────

/**
 * Export the audit log as a CSV file. The server streams `text/csv`, so we
 * cannot route through `api<T>()` which JSON-parses every response.
 *
 * This is the ONE allowed raw-fetch in this service — same exception pattern
 * as `invoice-share.service.ts` and `report.service.ts` (blob downloads),
 * documented in scripts/enforce-offline.mjs ALLOWED_RAW_FETCH allowlist.
 *
 * The endpoint is PinGated server-side (mutation routeClass). Without the
 * `api()` 403 interceptor, we must surface PIN_REQUIRED ourselves — the
 * caller (AuditExportButton) catches the error and asks the user to
 * navigate the page first (which triggers the gated 403 → PinPad retry
 * cycle naturally) before re-exporting. This keeps the export path simple
 * and avoids duplicating PinGate plumbing in two places.
 */
export async function exportAuditLog(
  filters: AuditSearchFilters,
  signal?: AbortSignal,
): Promise<Blob> {
  const { API_URL } = await import('@/config/app.config')

  // Strip cursor/limit — server's export endpoint accepts only the same
  // filters as search minus pagination.
  const body = {
    q:          filters.q,
    entityType: filters.entityType,
    action:     filters.action,
    userId:     filters.userId,
    dateFrom:   filters.dateFrom,
    dateTo:     filters.dateTo,
  }

  const response = await fetch(`${API_URL}/audit/export`, {
    method:      'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'text/csv' },
    body:        JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new ApiError(
      `Export failed (${response.status})${text ? `: ${text.slice(0, 120)}` : ''}`,
      'EXPORT_FAILED',
      response.status,
    )
  }

  return response.blob()
}

/** Trigger a browser download of the given Blob with the supplied filename. */
export function downloadAuditCsv(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
