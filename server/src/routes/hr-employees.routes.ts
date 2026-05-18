/**
 * HR / Employees routes — Phase 6 PR6 (architecture §4 + §8.5 + §18.7 row 145).
 *
 * Endpoints (mounted under /api/hr/employees/* by hr.routes.ts):
 *
 *   POST   /          — create employee + paired STAFF Party (one tx)
 *   GET    /          — cursor-paginated list, tenant-scoped
 *   GET    /:id       — single employee, tenant-scoped
 *   PATCH  /:id       — partial update; partyId IMMUTABLE (§8.5)
 *   DELETE /:id       — soft-delete employee + paired Party in one tx
 *
 * Middleware chain (per architecture §11):
 *
 *   WRITES (POST/PATCH/DELETE):
 *     requireRecentPin('mutation') → requireOwner → requireIdempotencyKey →
 *     idempotencyCheck → validate(...) → handler
 *
 *   READS (GET):
 *     requireOwner → handler
 *
 * `auth + requireActiveBusiness` are applied at the parent (hr.routes.ts)
 * via `router.use(...)`. Until per-feature 'hr.read'/'hr.write' permission
 * keys ship in a later PR, all routes gate behind `requireOwner()` — same
 * decision as PR4 audit / PR5 attendance.
 *
 * PIN class — writes use 'mutation' (5-min grace) because Employee fields
 * propagate into payroll compute. List/get are NOT PIN-gated.
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
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeIdParamSchema,
  listEmployeesQuerySchema,
  type CreateEmployeeBody,
  type UpdateEmployeeBody,
} from '../schemas/employee.schemas.js'
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
  listEmployees,
  getEmployee,
} from '../services/hr/employee.service.js'

const router = Router()

/**
 * POST /api/hr/employees — create employee + paired STAFF Party (one tx).
 *
 * Body: { name, phone?, designation?, dailyRatePaise, userId? }
 * Returns: { employee, party }
 */
router.post(
  '/',
  requireRecentPin('mutation'),
  requireOwner(),
  requireIdempotencyKey,
  idempotencyCheck(),
  validate(createEmployeeSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.activeBusiness!.id
    const userId = req.user!.userId
    const body = req.body as CreateEmployeeBody

    const result = await createEmployee(
      {
        name: body.name,
        phone: body.phone ?? null,
        designation: body.designation ?? null,
        dailyRatePaise: body.dailyRatePaise,
        userId: body.userId ?? null,
      },
      { userId, businessId },
    )

    sendSuccess(res, result)
  }),
)

/**
 * GET /api/hr/employees?q=&isDeleted=&limit=&cursor= — cursor-paginated list.
 */
router.get(
  '/',
  requireOwner(),
  asyncHandler(async (req, res) => {
    const businessId = req.activeBusiness!.id
    const userId = req.user!.userId
    const parsed = listEmployeesQuerySchema.parse(req.query)

    const result = await listEmployees(parsed, { userId, businessId })

    sendSuccess(res, result)
  }),
)

/**
 * GET /api/hr/employees/:id — single employee, tenant-scoped.
 *
 * 404 EMPLOYEE_NOT_FOUND when missing OR cross-tenant — never leak existence.
 */
router.get(
  '/:id',
  requireOwner(),
  asyncHandler(async (req, res) => {
    const businessId = req.activeBusiness!.id
    const userId = req.user!.userId
    const { id } = employeeIdParamSchema.parse(req.params)

    const employee = await getEmployee(id, { userId, businessId })

    sendSuccess(res, { employee })
  }),
)

/**
 * PATCH /api/hr/employees/:id — partial update.
 *
 * `partyId` is IMMUTABLE (rejected by schema strict()). name/phone mirror
 * to the paired Party row in the same $transaction.
 */
router.patch(
  '/:id',
  requireRecentPin('mutation'),
  requireOwner(),
  requireIdempotencyKey,
  idempotencyCheck(),
  validate(updateEmployeeSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.activeBusiness!.id
    const userId = req.user!.userId
    const { id } = employeeIdParamSchema.parse(req.params)
    const body = req.body as UpdateEmployeeBody

    const employee = await updateEmployee(id, body, { userId, businessId })

    sendSuccess(res, { employee })
  }),
)

/**
 * DELETE /api/hr/employees/:id — soft-delete employee + paired Party.
 *
 * One $transaction sets Employee.isDeleted=true AND Party.isActive=false
 * + Party.isDeleted=true (architecture §8.5 — partial soft-delete forbidden).
 */
router.delete(
  '/:id',
  requireRecentPin('mutation'),
  requireOwner(),
  requireIdempotencyKey,
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const businessId = req.activeBusiness!.id
    const userId = req.user!.userId
    const { id } = employeeIdParamSchema.parse(req.params)

    const employee = await deleteEmployee(id, { userId, businessId })

    sendSuccess(res, { employee })
  }),
)

export default router
