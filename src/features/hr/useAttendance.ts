/** useAttendance — Phase 6 PR5 FE
 *
 * Combines:
 *   - useAttendanceRange()  : React Query GET /hr/attendance for a date window
 *   - useAttendanceBatch()  : React Query POST /hr/attendance/batch (idem key)
 *   - usePendingAttendance(): client-side dirty-cell state for the grid
 *
 * Pending edits live in React state — they are NEVER written to
 * localStorage/IndexedDB (OFFLINE_RULES Rule 4). The offline queue picks up
 * the mutation if the user is offline when they tap Save; the optimistic `{}`
 * return from api() is tolerated by the mutation handler which never reads
 * response fields beyond .written.
 */

import { useCallback, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ApiError } from '@/lib/api'
import { listAttendance, saveAttendanceBatch } from './attendance.service'
import type {
  AttendanceRow,
  AttendanceStatus,
  AttendanceCellKey,
  PendingAttendanceEdit,
} from './hr.types'

// ─── Query keys ──────────────────────────────────────────────────────────────

export const attendanceKeys = {
  all:   () => ['hr', 'attendance'] as const,
  range: (from: string, to: string, employeeIds: string[] | undefined) =>
    ['hr', 'attendance', 'range', from, to, (employeeIds ?? []).join(',')] as const,
}

// ─── Cell-key helpers ────────────────────────────────────────────────────────

export function cellKey(employeeId: string, date: string): AttendanceCellKey {
  return `${employeeId}|${date}`
}

export function parseCellKey(key: AttendanceCellKey): { employeeId: string; date: string } {
  const sep = key.indexOf('|')
  return { employeeId: key.slice(0, sep), date: key.slice(sep + 1) }
}

// ─── useAttendanceRange ──────────────────────────────────────────────────────

/** Load all attendance rows in [from, to], optionally filtered to employeeIds. */
export function useAttendanceRange(
  from: string,
  to: string,
  employeeIds: string[] | undefined,
) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: attendanceKeys.range(from, to, employeeIds),
    queryFn: ({ signal }) => listAttendance(from, to, employeeIds, signal),
    staleTime: 30_000,
  })

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: attendanceKeys.all() })
  }, [queryClient])

  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return {
    rows: (query.data?.rows ?? []) as AttendanceRow[],
    status,
    error: query.error,
    refresh,
  }
}

// ─── usePendingAttendance ────────────────────────────────────────────────────

/**
 * Local dirty-state for the grid. The grid hands us a (employeeId, date,
 * status) on every tap; we deduplicate by (employeeId, date) so re-tapping a
 * cell just updates the staged value. Save → flush via useAttendanceBatch.
 *
 * The "discard" path simply clears the Map — no rollback of cell state is
 * needed because the grid renders pending OVER persisted state (see
 * AttendanceGrid.tsx).
 */
export function usePendingAttendance() {
  const [pending, setPending] = useState<Map<AttendanceCellKey, AttendanceStatus>>(
    () => new Map(),
  )

  const setCell = useCallback((employeeId: string, date: string, status: AttendanceStatus) => {
    setPending((prev) => {
      const next = new Map(prev)
      next.set(cellKey(employeeId, date), status)
      return next
    })
  }, [])

  const clearCell = useCallback((employeeId: string, date: string) => {
    setPending((prev) => {
      if (!prev.has(cellKey(employeeId, date))) return prev
      const next = new Map(prev)
      next.delete(cellKey(employeeId, date))
      return next
    })
  }, [])

  const clearAll = useCallback(() => setPending(new Map()), [])

  const toBatchEntries = useCallback((): PendingAttendanceEdit[] => {
    const out: PendingAttendanceEdit[] = []
    pending.forEach((status, key) => {
      const { employeeId, date } = parseCellKey(key)
      out.push({ employeeId, date, status })
    })
    return out
  }, [pending])

  return {
    pending,
    count: pending.size,
    setCell,
    clearCell,
    clearAll,
    toBatchEntries,
  }
}

// ─── useAttendanceBatch ──────────────────────────────────────────────────────

/**
 * POST /hr/attendance/batch with a fresh UUID idempotency key per call.
 *
 * On success: invalidate every attendance range query (covers prev/next-week
 * navigations the user may have done while edits sat pending), show a toast,
 * and clear the pending state via the caller-supplied `onSuccess`.
 *
 * On error: surface the message — ApiError carries `code` (e.g.
 * INVALID_EMPLOYEE_ID) and `message` from the server.
 */
export function useAttendanceBatch() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { t } = useLanguage()

  return useMutation({
    mutationFn: async (entries: PendingAttendanceEdit[]) => {
      const idempotencyKey = crypto.randomUUID()
      return saveAttendanceBatch({ entries }, idempotencyKey)
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: attendanceKeys.all() })
      // Tolerate the optimistic `{}` from the offline queue — `result.written`
      // may be undefined when api() short-circuits the mutation for queueing.
      const written = (result as { written?: number } | undefined)?.written ?? 0
      const msg = navigator.onLine
        ? `${t.attendanceSavedToast} (${written})`
        : t.attendanceSavedToast
      toast.success(msg)
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : t.attendanceSaveErrorToast
      toast.error(msg)
    },
  })
}

// ─── Selector helpers used by the grid ───────────────────────────────────────

/** Build a (employeeId|date → AttendanceRow) lookup from a flat row list. */
export function indexRowsByCell(rows: AttendanceRow[]): Map<AttendanceCellKey, AttendanceRow> {
  const map = new Map<AttendanceCellKey, AttendanceRow>()
  for (const row of rows) {
    map.set(cellKey(row.employeeId, normalizeIsoDate(row.date)), row)
  }
  return map
}

/** Strip the time component if the BE returns ISO-with-time (Postgres DATE
 * comes back as YYYY-MM-DDT00:00:00.000Z under Prisma's default serializer). */
export function normalizeIsoDate(value: string): string {
  if (value.length > 10 && value.charAt(10) === 'T') return value.slice(0, 10)
  return value
}

/** Wrap pending overlay over persisted rows for the grid renderer. */
export function selectCellStatus(
  persisted: Map<AttendanceCellKey, AttendanceRow>,
  pending: Map<AttendanceCellKey, AttendanceStatus>,
  employeeId: string,
  date: string,
): { status: AttendanceStatus | null; isDirty: boolean } {
  const key = cellKey(employeeId, date)
  if (pending.has(key)) return { status: pending.get(key) ?? null, isDirty: true }
  const row = persisted.get(key)
  return { status: row ? row.status : null, isDirty: false }
}

/** Bound the number of pending edits to the BE's per-batch cap. */
export function hasReachedBatchCap(pending: Map<AttendanceCellKey, AttendanceStatus>): boolean {
  return pending.size >= 500
}

/** Cycle to the next status in ATTENDANCE_CYCLE (wraps at end). */
export function nextStatus(current: AttendanceStatus | null, cycle: ReadonlyArray<AttendanceStatus>): AttendanceStatus {
  if (current === null) return cycle[0]
  const idx = cycle.indexOf(current)
  return cycle[(idx + 1) % cycle.length]
}

/** Memoization shim so the grid props can compare a stable Map ref. */
export function usePersistedIndex(rows: AttendanceRow[]): Map<AttendanceCellKey, AttendanceRow> {
  return useMemo(() => indexRowsByCell(rows), [rows])
}
