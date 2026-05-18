/**
 * Payroll routes — Phase 6 PR6 (architecture §6.1 + §8 + §18.7 row 151).
 *
 * Endpoints (all under /api/payroll):
 *
 *   POST /run/preview        — dry-run preview (no writes). Rate-limited 10/min/business.
 *   POST /run/finalize       — finalize a period (writes PayrollRun + Payment + Payroll
 *                              + PayslipSnapshot + AuditLog in one $transaction §8.1).
 *   POST /run/:id/reverse    — reverse a finalized run (inverse-direction-same-amount
 *                              PAYROLL_IN payments per §8.3; second reverse → 409
 *                              PAYMENT_ALREADY_REVERSED via Payment.reversesPaymentId @unique).
 *   GET  /:id/snapshot       — fetch the immutable payslip JSON for ONE Payroll.id.
 *
 * Middleware chain (per architecture §11):
 *
 *   PREVIEW:
 *     auth → requireActiveBusiness → requireOwner → previewRateLimit →
 *     validate(previewPayrollSchema) → handler
 *
 *   FINALIZE / REVERSE:
 *     auth → requireActiveBusiness → requireRecentPin('mutation') →
 *     requireOwner → requireIdempotencyKey → idempotencyCheck →
 *     validate(...) → handler
 *
 *   SNAPSHOT (GET):
 *     auth → requireActiveBusiness → requireOwner → handler
 *
 * Permission gate — Phase 6 has NO `payroll.*` permission keys yet (same
 * decision as audit / hr). Until those land, every write gates behind
 * `requireOwner()`. Preview tightens to read-only owner+rate-limit.
 *
 * PIN class — finalize & reverse use 'mutation' (5-min grace) because they
 * write Payment + Payroll. Preview is NOT PIN-gated (read-only, but
 * rate-limited per §8.4).
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
import { createPerBusinessLimiter } from '../middleware/rate-limit/per-business-factory.js'
import { sendSuccess } from '../lib/response.js'
import {
  previewPayrollSchema,
  finalizePayrollSchema,
  payrollIdParamSchema,
  reversePayrollBodySchema,
  type PreviewPayrollBody,
  type FinalizePayrollBody,
} from '../schemas/payroll.schemas.js'
import {
  previewPayrollRun,
  finalizePayrollRun,
  reversePayrollRun,
} from '../services/payroll/payroll-run.service.js'
import { getPayslipSnapshot } from '../services/payroll/payroll-snapshot.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

// Every payroll route requires an authenticated session with an active business.
router.use(auth, requireActiveBusiness)

/**
 * §8.4 — payrollPreviewRateLimit = 10 calls/min per business. Heavy compute
 * over Attendance + EmployeeAdvance; cap prevents a buggy client (or hostile
 * scraper) from saturating the DB read pool.
 */
const previewRateLimit = createPerBusinessLimiter('payroll-preview', 10, 60_000, {
  eventName: 'PAYROLL_PREVIEW_RATE_LIMIT',
  message: 'Too many payroll previews. Try again in a minute.',
})

/**
 * POST /api/payroll/run/preview
 *
 * Body: { fromDate, toDate, employeeIds? }
 * Returns: { fromDate, toDate, lines: [...], totals: { grossPaise, netPaise, count } }
 *
 * No writes. No audit. Pure compute over Attendance + EmployeeAdvance.
 */
router.post(
  '/run/preview',
  requireOwner(),
  previewRateLimit,
  validate(previewPayrollSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.activeBusiness!.id
    const body = req.body as PreviewPayrollBody

    const result = await previewPayrollRun({
      businessId,
      fromDate: body.fromDate,
      toDate: body.toDate,
      employeeIds: body.employeeIds,
    })

    sendSuccess(res, result)
  }),
)

/**
 * POST /api/payroll/run/finalize
 *
 * Body: { fromDate, toDate, employeeIds?, mode? }
 * Returns: { payrollRunId, status: 'FINALIZED', totalNetPaise, count }
 *
 * Writes PayrollRun + N Payment + N Payroll + N PayslipSnapshot + 1 AuditLog
 * in one $transaction (architecture §8.1). Period overlap → 409
 * PAYROLL_PERIOD_OVERLAP via the @@unique([businessId, fromDate, toDate]).
 */
router.post(
  '/run/finalize',
  requireRecentPin('mutation'),
  requireOwner(),
  requireIdempotencyKey,
  idempotencyCheck(),
  validate(finalizePayrollSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.activeBusiness!.id
    const userId = req.user!.userId
    const body = req.body as FinalizePayrollBody

    // Pull business name/phone once for the payslip snapshot payload.
    const biz = await prisma.business.findFirst({
      where: { id: businessId },
      select: { id: true, name: true, phone: true },
    })

    const result = await finalizePayrollRun(
      {
        businessId,
        fromDate: body.fromDate,
        toDate: body.toDate,
        employeeIds: body.employeeIds,
        mode: body.mode,
      },
      {
        userId,
        businessId,
        businessName: biz?.name ?? '',
        businessPhone: biz?.phone ?? null,
      },
    )

    sendSuccess(res, result)
  }),
)

/**
 * POST /api/payroll/run/:id/reverse
 *
 * Body: {} (empty — action is in the path)
 * Returns: { payrollRunId, status: 'REVERSED', reversedCount, totalReversedPaise }
 *
 * Writes inverse-direction-same-amount PAYROLL_IN Payment per constituent
 * Payroll. Second reverse → 409 PAYMENT_ALREADY_REVERSED (Prisma P2002 on
 * Payment.reversesPaymentId @unique, caught + retranslated by the service).
 */
router.post(
  '/run/:id/reverse',
  requireRecentPin('mutation'),
  requireOwner(),
  requireIdempotencyKey,
  idempotencyCheck(),
  validate(reversePayrollBodySchema),
  asyncHandler(async (req, res) => {
    const businessId = req.activeBusiness!.id
    const userId = req.user!.userId
    const { id } = payrollIdParamSchema.parse(req.params)

    const result = await reversePayrollRun({ payrollRunId: id }, { userId, businessId })

    sendSuccess(res, result)
  }),
)

/**
 * GET /api/payroll/:id/snapshot
 *
 * Returns the immutable payslip JSON for one Payroll.id. Throws 404
 * PAYROLL_NOT_FOUND on missing OR cross-tenant; 404 PAYSLIP_SNAPSHOT_NOT_FOUND
 * if the run was never finalized (no snapshot row exists yet).
 */
router.get(
  '/:id/snapshot',
  requireOwner(),
  asyncHandler(async (req, res) => {
    const businessId = req.activeBusiness!.id
    const { id } = payrollIdParamSchema.parse(req.params)

    const result = await getPayslipSnapshot({ businessId, payrollId: id })

    sendSuccess(res, result)
  }),
)

export default router
