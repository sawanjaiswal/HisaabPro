/** HR feature types — Phase 6 PR5 FE
 *
 * Wire shapes mirror server/src/services/hr/attendance.service.ts return shape.
 * Note that the BE select clause omits `createdById` from list rows even
 * though the column exists, so the FE list type follows the wire (not the
 * Prisma model).
 */

// ─── Attendance status enum ──────────────────────────────────────────────────

export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'HALF_DAY'
  | 'LEAVE_PAID'
  | 'LEAVE_UNPAID'

export const ATTENDANCE_STATUSES: ReadonlyArray<AttendanceStatus> = [
  'PRESENT',
  'HALF_DAY',
  'ABSENT',
  'LEAVE_PAID',
  'LEAVE_UNPAID',
] as const

// ─── List wire shapes ────────────────────────────────────────────────────────

/** A single Attendance row as returned by GET /hr/attendance.
 * `date` and `createdAt` are ISO strings on the wire. */
export interface AttendanceRow {
  id: string
  businessId: string
  employeeId: string
  date: string         // yyyy-mm-dd (BE Postgres DATE → JSON)
  status: AttendanceStatus
  overtimeMin: number  // 0..720
  note: string | null
  createdAt: string    // ISO 8601 datetime
}

export interface AttendanceListResponse {
  rows: AttendanceRow[]
}

// ─── Batch write shapes ──────────────────────────────────────────────────────

export interface AttendanceBatchEntry {
  employeeId: string
  date: string
  status: AttendanceStatus
  overtimeMin?: number
  note?: string
}

export interface AttendanceBatchPayload {
  entries: AttendanceBatchEntry[]
}

export interface AttendanceBatchResult {
  written: number
  byStatus: Record<string, number>
}

// ─── Employee (PR6 — thin shape used only as a foreign key for the grid) ─────

/** Minimal Employee shape consumed by the grid header column.
 * PR6 ships the full CRUD; PR5 tolerates the 404 and renders an empty state. */
export interface EmployeeLite {
  id: string
  name: string
  role: string | null
  active: boolean
}

export interface EmployeeListResponse {
  employees: EmployeeLite[]
}

// ─── Grid pending-changes state ──────────────────────────────────────────────

/** Composite key for a (employee, date) cell — used to dedupe pending edits. */
export type AttendanceCellKey = string // `${employeeId}|${yyyy-mm-dd}`

export interface PendingAttendanceEdit {
  employeeId: string
  date: string
  status: AttendanceStatus
}
