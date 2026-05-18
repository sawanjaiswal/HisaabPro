/**
 * Zod schemas for /api/hr/attendance/* endpoints (Phase 6 PR5).
 *
 * All schemas are `.strict()` per A01.1 (reject unknown body keys to defeat
 * mass-assignment attempts that would propagate into Prisma where-clauses).
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §4.1 (Attendance behaviour) +
 * §18.6 row 133. Schema is row 133 of the PR5 file plan.
 */
import { z } from 'zod'

/**
 * Attendance.status enum — must match the union written by the Postgres
 * `Attendance.status` column (string, not native enum, per schema.prisma:3960
 * inline comment). New values added here MUST also be recognised by the
 * payroll-compute layer (PR6) which sums overtimeMin only for non-ABSENT
 * statuses.
 */
export const ATTENDANCE_STATUSES = [
  'PRESENT',
  'ABSENT',
  'HALF_DAY',
  'LEAVE_PAID',
  'LEAVE_UNPAID',
] as const

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

/** Date wire format — yyyy-mm-dd. Service converts to a Postgres DATE
 *  via `new Date(...)`. Reject any other ISO variant at the schema. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * POST /api/hr/attendance/batch — bulk mark/edit attendance.
 *
 *   { entries: [{ employeeId, date, status, overtimeMin?, note? }, ...] }
 *
 * Bounds:
 *   - entries: 1..500 per batch (500 = ~16 days × 30 employees; bigger
 *     batches multiply DB lock pressure inside the single $transaction).
 *   - overtimeMin: 0..720 (12h sanity cap — anyone clocking >12h overtime
 *     in a single day on a billing app is fat-fingering hours-as-minutes).
 *   - note: max 500 chars trimmed.
 */
export const attendanceBatchSchema = z.object({
  entries: z.array(z.object({
    employeeId: z.string().cuid('employeeId must be a cuid'),
    date: z.string().regex(DATE_RE, 'date must be yyyy-mm-dd'),
    status: z.enum(ATTENDANCE_STATUSES),
    overtimeMin: z.number().int().min(0).max(720).default(0),
    note: z.string().trim().max(500).optional(),
  }).strict()).min(1, 'entries cannot be empty').max(500, 'entries capped at 500 per batch'),
}).strict()

/**
 * GET /api/hr/attendance?from=...&to=...&employeeIds=cuid,cuid,...
 *
 * - from/to required (yyyy-mm-dd); service enforces from <= to + 92-day cap.
 * - employeeIds optional CSV; absent = all employees in business in range.
 *   Capped at 200 ids to bound the IN-list. Each split id is also cuid-checked
 *   by the service (validate-against-Employee SELECT — A01.1) but we trim and
 *   filter empties here so a trailing comma doesn't 400 the request.
 */
export const attendanceListQuerySchema = z.object({
  from: z.string().regex(DATE_RE, 'from must be yyyy-mm-dd'),
  to: z.string().regex(DATE_RE, 'to must be yyyy-mm-dd'),
  employeeIds: z.string().optional()
    .transform((v) => v?.split(',').map((s) => s.trim()).filter(Boolean))
    .refine((arr) => arr === undefined || arr.length <= 200, 'max 200 employeeIds'),
}).strict()

export type AttendanceBatchInput = z.infer<typeof attendanceBatchSchema>
export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>
