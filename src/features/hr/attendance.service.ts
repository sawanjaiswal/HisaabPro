/** Attendance — Phase 6 PR5 FE service layer
 *
 * Endpoints (all under /api/hr — api() prepends API_URL):
 *
 *   GET  /hr/attendance?from=yyyy-mm-dd&to=yyyy-mm-dd&employeeIds=cuid,cuid
 *     → { rows: AttendanceRow[] }
 *   POST /hr/attendance/batch                  (header X-Idempotency-Key: uuid)
 *     body: { entries: [{ employeeId, date, status, overtimeMin?, note? }] }
 *     → { written: number, byStatus: Record<string, number> }
 *
 * PinGateProvider auto-handles 403 PIN_REQUIRED via api()'s interceptor — no
 * special handling here. Mutations pass `entityType: 'attendance'` and
 * `entityLabel` so the offline queue UI is readable. The idempotency key is
 * minted by the caller (the React Query mutation hook) so a network retry
 * replays the same key.
 */

import { api } from '@/lib/api'
import type {
  AttendanceBatchPayload,
  AttendanceBatchResult,
  AttendanceListResponse,
} from './hr.types'

// ─── Query builder ───────────────────────────────────────────────────────────

/**
 * Build the query string for GET /hr/attendance. Always emits `from` and `to`
 * (required by the BE Zod schema). `employeeIds` is omitted when empty so the
 * BE returns every employee in the business within the range.
 */
export function buildAttendanceListQuery(params: {
  from: string
  to: string
  employeeIds?: string[]
}): string {
  const { from, to, employeeIds } = params
  const q = new URLSearchParams()
  q.set('from', from)
  q.set('to', to)
  if (employeeIds && employeeIds.length > 0) {
    q.set('employeeIds', employeeIds.join(','))
  }
  return q.toString()
}

// ─── List ────────────────────────────────────────────────────────────────────

/** Fetch every attendance row in [from, to] (≤92 days) for the given employees. */
export async function listAttendance(
  from: string,
  to: string,
  employeeIds: string[] | undefined,
  signal?: AbortSignal,
): Promise<AttendanceListResponse> {
  const qs = buildAttendanceListQuery({ from, to, employeeIds })
  return api<AttendanceListResponse>(`/hr/attendance?${qs}`, { signal })
}

// ─── Batch upsert ────────────────────────────────────────────────────────────

/**
 * POST /hr/attendance/batch — upsert N entries atomically.
 *
 * `idempotencyKey` MUST be a fresh UUID per logical attempt (mint with
 * crypto.randomUUID() in the caller). A network retry — including the
 * offline queue replay — sends the SAME key so the BE de-dupes.
 *
 * `entityLabel` is "Attendance batch (N entries)" — surfaces in the
 * SyncQueueDrawer when this request is queued offline.
 */
export async function saveAttendanceBatch(
  payload: AttendanceBatchPayload,
  idempotencyKey: string,
): Promise<AttendanceBatchResult> {
  return api<AttendanceBatchResult>('/hr/attendance/batch', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'X-Idempotency-Key': idempotencyKey },
    entityType: 'attendance',
    entityLabel: `Attendance batch (${payload.entries.length} entries)`,
  })
}
