/** HR feature types — Phase 6 PR5 + PR6 FE
 *
 * Wire shapes mirror the BE services:
 *   - server/src/services/hr/attendance.service.ts  (PR5)
 *   - server/src/services/hr/employee.service.ts    (PR6)
 *
 * Note the BE attendance list omits `createdById` from rows even though the
 * column exists, so the FE list type follows the wire (not the Prisma model).
 *
 * `Employee` mirrors the Prisma row (paise integers, ISO datetimes as strings).
 * `EmployeeLite` is the trimmed shape consumed by the attendance grid header —
 * we keep both so legacy PR5 callers (`emp.role`) keep working unchanged.
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

// ─── Attendance list wire shapes ─────────────────────────────────────────────

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

// ─── Attendance batch write shapes ───────────────────────────────────────────

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

// ─── Employee (PR6) ──────────────────────────────────────────────────────────

/** Full Employee wire row from GET /hr/employees + GET /hr/employees/:id.
 *  `dailyRate` is paise (Int); ISO strings on the wire for all dates. */
export interface Employee {
  id: string
  businessId: string
  partyId: string
  userId: string | null
  name: string
  phone: string | null
  designation: string | null
  /** Daily rate in PAISE (1 Rs = 100 paise). */
  dailyRate: number
  joinedAt: string | null
  leftAt: string | null
  createdById: string | null
  isDeleted: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Form input — `dailyRatePaise` matches the BE Zod field name. */
export interface EmployeeInput {
  name: string
  phone?: string | null
  designation?: string | null
  /** Daily rate in PAISE. 0..1_000_000. */
  dailyRatePaise: number
  userId?: string | null
}

/** Patch shape for PATCH /hr/employees/:id — every field optional. */
export interface EmployeePatchInput {
  name?: string
  phone?: string | null
  designation?: string | null
  dailyRatePaise?: number
  userId?: string | null
  /** ISO datetime when left; null to clear. */
  leftAt?: string | null
}

/** Paginated list response from GET /hr/employees. */
export interface EmployeeListResponse {
  rows: Employee[]
  nextCursor: string | null
}

/** POST /hr/employees returns the new Employee + its paired STAFF Party. */
export interface EmployeeCreateResponse {
  employee: Employee
  /** Minimal Party shape — we only use id/name in the UI. */
  party: { id: string; name: string; type: 'STAFF' }
}

/** PATCH /hr/employees/:id returns the updated Employee. */
export interface EmployeeUpdateResponse {
  employee: Employee
}

/** Minimal Employee shape consumed by the attendance grid header column.
 *  PR5 shipped this name; PR6 keeps the surface stable. */
export interface EmployeeLite {
  id: string
  name: string
  role: string | null
  active: boolean
}

// ─── Grid pending-changes state ──────────────────────────────────────────────

/** Composite key for a (employee, date) cell — used to dedupe pending edits. */
export type AttendanceCellKey = string // `${employeeId}|${yyyy-mm-dd}`

export interface PendingAttendanceEdit {
  employeeId: string
  date: string
  status: AttendanceStatus
}
