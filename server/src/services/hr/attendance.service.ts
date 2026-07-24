/**
 * Attendance service — Phase 6 PR5 (architecture §4.1 + §6.1 row 708 + §18.6
 * row 131).
 *
 * Two operations:
 *
 *   upsertAttendanceBatch(...) — POST /api/hr/attendance/batch handler. Wraps
 *     N upserts on the (businessId, employeeId, date) @@unique key inside a
 *     single $transaction with ONE AuditLog row capturing the batch summary.
 *     Atomic — partial save not allowed.
 *
 *   listAttendance(...) — GET /api/hr/attendance handler. Range scan with
 *     optional employeeIds filter; tenant-scoped at every read (the activeBusinessId
 *     filter is the only thing keeping cross-tenant employeeIds from leaking
 *     data — never trust the client's id list).
 *
 * ────────────────────────────────────────────────────────────────────────
 *  CROSS-TENANT INVARIANTS (HARD — postmortem triggers, see §20):
 *
 *  1. Every Attendance write filters by `businessId === activeBusinessId`.
 *     `req.activeBusiness!.id` from the route — NEVER `req.user.businessId`
 *     directly. The route layer is responsible for the unwrap.
 *  2. Every `employeeId` in a batch is SELECT-validated against
 *     `Employee where { id IN (...), businessId: activeBusinessId }` BEFORE
 *     the upsert tx begins. If ANY employeeId is missing → throw
 *     AppError(VALIDATION_ERROR, 400, 'INVALID_EMPLOYEE_ID'). Do NOT silently
 *     skip; do NOT let the FK violation surface as a 500.
 *  3. The list endpoint filters `where businessId = activeBusinessId`. Even
 *     if the client supplies an employeeId from another tenant, the query
 *     returns [] (never 404, never 500 — empty result is the correct UX).
 *  4. NEVER read `req.user.id` (it does not exist on AuthRequest). Always
 *     `req.user.userId` (A01.1) — the route already does the unwrap and
 *     hands us the actorUserId.
 *
 *  These four lines are the difference between "tenant A sees their data"
 *  and "tenant A sees tenant B's data". Don't relax them.
 * ────────────────────────────────────────────────────────────────────────
 *
 * One AuditLog row per batch (entityId='' — no single canonical entity, per
 * existing batch-write pattern). Registered in audit-coverage.ts SSOT.
 */

import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import type { AttendanceStatus } from '../../schemas/attendance.schemas.js'
import { createAuditEntry } from '../settings/audit.js'

/** Maximum date range the list endpoint will scan (92 days = a quarter). */
export const ATTENDANCE_LIST_RANGE_MAX_DAYS = 92
/** Hard cap on rows returned by list — 31 days × ~150 employees. */
export const ATTENDANCE_LIST_ROW_CAP = 5000

export interface AttendanceBatchEntry {
  employeeId: string
  date: string // yyyy-mm-dd
  status: AttendanceStatus
  overtimeMin?: number
  note?: string
}

export interface AttendanceRow {
  id: string
  businessId: string
  employeeId: string
  date: Date
  status: string
  overtimeMin: number
  note: string | null
  createdAt: Date
}

export interface UpsertBatchParams {
  activeBusinessId: string
  actorUserId: string
  entries: AttendanceBatchEntry[]
  ipAddress?: string | null
  deviceInfo?: string | null
}

export interface UpsertBatchResult {
  written: number
  byStatus: Record<string, number>
}

export interface ListAttendanceParams {
  activeBusinessId: string
  from: string // yyyy-mm-dd
  to: string   // yyyy-mm-dd
  employeeIds?: string[]
}

/** ─── Batch upsert ──────────────────────────────────────────────────────── */

/**
 * Upsert a batch of Attendance rows atomically inside one $transaction.
 *
 * Sequence (atomic):
 *   1. SELECT Employee.id WHERE id IN (uniqEmployeeIds) AND businessId = activeBusinessId
 *      → reject with INVALID_EMPLOYEE_ID if any id is missing (cross-tenant
 *      or stale id). This is the only IDOR defense — the upsert below would
 *      otherwise FK-violate or, worse, accept the cross-tenant id because
 *      Attendance.employeeId has no tenant filter on the FK itself.
 *   2. N x upsert on (businessId, employeeId, date) — last-write-wins on
 *      the unique key.
 *   3. ONE auditLog.create with the batch summary.
 *
 * @throws AppError(VALIDATION_ERROR, 400, 'INVALID_EMPLOYEE_ID') on cross-tenant id
 */
export async function upsertAttendanceBatch(
  params: UpsertBatchParams,
): Promise<UpsertBatchResult> {
  const { activeBusinessId, actorUserId, entries, ipAddress, deviceInfo } = params

  // Pre-compute the unique employeeId set — one SELECT regardless of duplicates.
  const uniqEmployeeIds = Array.from(new Set(entries.map((e) => e.employeeId)))

  return prisma.$transaction(async (tx) => {
    // Tenant + existence check. The IN-list is bounded by the schema's
    // entries.max(500) → uniqEmployeeIds.length ≤ 500.
    const valid = await tx.employee.findMany({
      where: { id: { in: uniqEmployeeIds }, businessId: activeBusinessId },
      select: { id: true },
    })

    if (valid.length !== uniqEmployeeIds.length) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        'INVALID_EMPLOYEE_ID',
      )
    }

    // Per-entry upsert. Concurrent callers on the same (employee, date) hit
    // the @@unique constraint and one of them updates; no FK-violation 500.
    for (const e of entries) {
      const dateObj = new Date(e.date) // yyyy-mm-dd → midnight UTC; Postgres DATE strips time.
      await tx.attendance.upsert({
        where: {
          businessId_employeeId_date: {
            businessId: activeBusinessId,
            employeeId: e.employeeId,
            date: dateObj,
          },
        },
        create: {
          businessId: activeBusinessId,
          employeeId: e.employeeId,
          date: dateObj,
          status: e.status,
          overtimeMin: e.overtimeMin ?? 0,
          note: e.note ?? null,
          createdById: actorUserId,
        },
        update: {
          status: e.status,
          overtimeMin: e.overtimeMin ?? 0,
          note: e.note ?? null,
        },
      })
    }

    // Batch summary for the audit row. byStatus counts per status; dateRange
    // bounds give auditors a quick "what window did this batch touch?" view.
    const byStatus: Record<string, number> = {}
    for (const e of entries) {
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1
    }
    const sortedDates = entries.map((e) => e.date).sort()
    const dateRange = { from: sortedDates[0]!, to: sortedDates[sortedDates.length - 1]! }

    await createAuditEntry({
      businessId: activeBusinessId,
      entityType: 'Attendance',
      entityId: '', // batch — no single entity (per services/payment batch pattern)
      action: 'UPSERT_BATCH',
      userId: actorUserId,
      changes: { batchSize: entries.length, dateRange, byStatus },
      ipAddress: ipAddress ?? null,
      deviceInfo: deviceInfo ?? null,
    }, tx)

    return { written: entries.length, byStatus }
  })
}

/** ─── Range list ────────────────────────────────────────────────────────── */

/**
 * List attendance rows in a date range, optionally filtered by employeeIds.
 *
 * Tenant-scoped at the WHERE clause — even if the caller provides an
 * employeeId belonging to another tenant, the businessId predicate makes
 * Postgres return [] (no leak, no 500).
 *
 * @throws AppError(VALIDATION_ERROR, 400) on inverted range or > 92 days
 */
export async function listAttendance(params: ListAttendanceParams): Promise<AttendanceRow[]> {
  const { activeBusinessId, from, to, employeeIds } = params

  const fromDate = new Date(from)
  const toDate = new Date(to)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Invalid date format')
  }
  if (fromDate > toDate) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'from must be on or before to')
  }
  const spanMs = toDate.getTime() - fromDate.getTime()
  const spanDays = Math.floor(spanMs / (1000 * 60 * 60 * 24))
  if (spanDays > ATTENDANCE_LIST_RANGE_MAX_DAYS) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      400,
      `date range capped at ${ATTENDANCE_LIST_RANGE_MAX_DAYS} days`,
    )
  }

  return prisma.attendance.findMany({
    where: {
      businessId: activeBusinessId,
      date: { gte: fromDate, lte: toDate },
      ...(employeeIds && employeeIds.length > 0
        ? { employeeId: { in: employeeIds } }
        : {}),
    },
    select: {
      id: true,
      businessId: true,
      employeeId: true,
      date: true,
      status: true,
      overtimeMin: true,
      note: true,
      createdAt: true,
    },
    orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
    take: ATTENDANCE_LIST_ROW_CAP,
  })
}
