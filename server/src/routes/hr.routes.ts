/**
 * HR routes — Phase 6 PR5 (architecture §4.1 + §6.1 row 708 + §18.6 row 132).
 *
 * Endpoints (all under /api/hr):
 *
 *   POST /attendance/batch — mark/edit attendance for N employees x M dates
 *   GET  /attendance       — list attendance rows in a date range
 *
 * Middleware chain (per architecture §11):
 *
 *   POST /attendance/batch:
 *     auth → requireActiveBusiness → requireRecentPin('mutation') →
 *     requireOwner → requireIdempotencyKey → idempotencyCheck →
 *     validate(attendanceBatchSchema) → handler
 *
 *   GET /attendance:
 *     auth → requireActiveBusiness → requireOwner → handler
 *
 * Permission gate — Phase 6 has NO `hr.*` permission keys yet (same situation
 * as PR4 BE audit.routes.ts). Until those land we gate writes behind
 * `requireOwner()`. When per-feature permissions ship in a future PR the
 * write route gets an extra `requirePermission('hr.write')` line and the
 * read route gets `requirePermission('hr.read')` BEFORE `requireOwner()`,
 * WITHOUT changing handler logic. See PR4 BE audit.routes.ts header for the
 * same pattern.
 *
 * PIN class — writes use 'mutation' (5-min grace) because attendance entries
 * feed payroll compute. Reads are NOT PIN-gated (consistent with PR4 audit
 * 'read-only' decision-cost vs. UX cost — attendance grid is reviewed often).
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { requireActiveBusiness } from '../middleware/require-active-business.js'
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

// All HR routes require an authenticated session with an active business.
// (See PR4 audit.routes.ts for the same `router.use(...)` precedent —
// individual routes still stack their own PIN + owner middleware.)
router.use(auth, requireActiveBusiness)

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
  '/attendance/batch',
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
  '/attendance',
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
