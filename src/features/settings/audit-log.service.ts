/** Audit Log — API service layer
 *
 * All service functions accept an optional AbortSignal for cleanup in useEffect.
 * The `api()` helper already prepends API_URL, so paths begin with /.
 */

import { api } from '@/lib/api'
import type { AuditLogFilters, AuditLogResponse } from './settings.types'

// ─── Query builder helpers ────────────────────────────────────────────────────

/**
 * Builds a URLSearchParams query string from AuditLogFilters.
 * Only appends params that have defined, non-empty values.
 */
function buildAuditQuery(filters: AuditLogFilters): string {
  const params = new URLSearchParams()

  const { userId, entityType, action, from, to, page, limit } = filters

  if (userId !== undefined) params.set('userId', userId)
  if (entityType !== undefined) params.set('entityType', entityType)
  if (action !== undefined) params.set('action', action)
  if (from !== undefined) params.set('from', from)
  if (to !== undefined) params.set('to', to)
  params.set('page', String(page))
  params.set('limit', String(limit))

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

/**
 * Fetch the audit log for the business with optional filters.
 * Supports filtering by userId, entityType, action type, and date range.
 * Paginated — default limit 50, max 200.
 * Returns 403 if the caller does not have AUDIT_LOG permission.
 */
export async function getAuditLog(
  businessId: string,
  filters: AuditLogFilters,
  signal?: AbortSignal
): Promise<AuditLogResponse> {
  return api<AuditLogResponse>(
    `/businesses/${businessId}/audit-log${buildAuditQuery(filters)}`,
    { signal }
  )
}
