/**
 * HR / Attendance routes — Phase 6 PR5 (architecture §4.1 + §18.6).
 *
 * Split out of hr.routes.ts (PR6) so that file becomes a tiny aggregator
 * mounting both the attendance sub-router (this file) and the employees
 * sub-router (hr-employees.routes.ts). Keeps each file ≤ 250L.
 *
 * Endpoints (mounted under /api/hr/attendance/* by hr.routes.ts):
 *
 *   POST /attendance/batch — mark/edit attendance for N employees x M dates
 *   GET  /attendance       — list attendance rows in a date range
 *
 * Middleware chain (per architecture §11):
 *
 *   POST: auth → requireActiveBusiness → requireRecentPin('mutation') →
 *         requireOwner → requireIdempotencyKey → idempotencyCheck →
 *         validate(attendanceBatchSchema) → handler
 *   GET : auth → requireActiveBusiness → requireOwner → handler
 *
 * `router.use(auth, requireActiveBusiness)` happens at the parent
 * (hr.routes.ts) — both sub-routers inherit that prefix.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requireRecentPin } from '../middleware/require-recent-pin.js'
import { requireOwner } from '../middleware/permission.js'
import { requireIdempotencyKey } from '../middleware/requireIdempotencyKey.js'
import { idempotencyCheck } from '../middleware/idempotency.js'
import { validate } from '../middleware/validate.js'
import { sendSuccess } from '../lib/response.js'
import {
  attendanceBatchSchema,
  attendanceListQuerySchema,
} from '../schemas/attendance.schemas.js'
import {
  upsertAttendanceBatch,
  listAttendance,
  type AttendanceBatchEntry,
} from '../services/hr/attendance.service.js'

const router = Router()

/**
 * POST /api/hr/attendance/batch
 *
 * Body: { entries: [{ employeeId, date, status, overtimeMin?, note? }, ...] }
 *
 * Atomic — all entries upsert in ONE $transaction together with ONE AuditLog
 * row. Cross-tenant employeeId is rejected with 400 INVALID_EMPLOYEE_ID
 * BEFORE the upsert begins (see service header for the IDOR rationale).
 *
 * Class: 'mutation' (5-min grace). Idempotency-keyed: clients on 2G/3G should
 * mint a UUID v4 per attempt and replay the same key on retry.
 */
router.post(
  '/batch',
  requireRecentPin('mutation'),
  requireOwner(),
  requireIdempotencyKey,
  idempotencyCheck(),
  validate(attendanceBatchSchema),
  asyncHandler(async (req, res) => {
    const activeBusinessId = req.activeBusiness!.id
    const actorUserId = req.user!.userId
    const { entries } = req.body as { entries: AttendanceBatchEntry[] }

    const result = await upsertAttendanceBatch({
      activeBusinessId,
      actorUserId,
      entries,
      ipAddress: req.ip ?? null,
      deviceInfo: req.get('user-agent') ?? null,
    })

    sendSuccess(res, result)
  }),
)

/**
 * GET /api/hr/attendance?from=yyyy-mm-dd&to=yyyy-mm-dd&employeeIds=cuid,cuid,...
 *
 * employeeIds optional — omit to return every employee in the business
 * within the date range. Range capped at 92 days; rows capped at 5000. The
 * tenant filter (`businessId = activeBusinessId`) is applied unconditionally
 * — cross-tenant employeeIds return [] (never 404, never 500).
 *
 * We don't use `validate(schema)` here — that middleware parses req.body,
 * which is empty for GET. Instead, the handler parses req.query directly;
 * on ZodError the global errorHandler maps to 400 VALIDATION_ERROR.
 */
router.get(
  '/',
  requireOwner(),
  asyncHandler(async (req, res) => {
    const activeBusinessId = req.activeBusiness!.id
    const parsed = attendanceListQuerySchema.parse(req.query)

    const rows = await listAttendance({
      activeBusinessId,
      from: parsed.from,
      to: parsed.to,
      employeeIds: parsed.employeeIds,
    })

    sendSuccess(res, { rows })
  }),
)

export default router
