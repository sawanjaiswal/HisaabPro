/**
 * Admin User Management Routes
 * GET  /api/admin/users              — list (paginated)
 * GET  /api/admin/users/:id          — detail
 * POST /api/admin/users/:id/suspend  — SUPER_ADMIN only
 * POST /api/admin/users/:id/unsuspend — SUPER_ADMIN only
 * POST /api/admin/users/:id/unlock   — SUPER_ADMIN only
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { requireAdmin, requireSuperAdmin, auditAdminAction } from '../../middleware/admin-auth.js'
import {
  suspendUserSchema,
  unsuspendUserSchema,
  listUsersQuerySchema,
} from '../../schemas/admin.schemas.js'
import {
  getAllUsers,
  getUserDetails,
  suspendUser,
  unsuspendUser,
  unlockUser,
} from '../../services/admin/index.js'
import { sendSuccess, sendPaginated } from '../../lib/response.js'

const router = Router()

// All user routes require admin auth
router.use(requireAdmin)

// --------------------------------------------------------------------------
// GET / — list users
// --------------------------------------------------------------------------

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listUsersQuerySchema.parse({
      cursor: req.query['cursor'],
      limit: req.query['limit'],
      search: req.query['search'],
      status: req.query['status'],
    })

    const { users, nextCursor } = await getAllUsers(query)
    sendPaginated(res, users, nextCursor)
  })
)

// --------------------------------------------------------------------------
// GET /:id — user detail
// --------------------------------------------------------------------------

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = req.params['id'] as string
    const details = await getUserDetails(userId)
    await auditAdminAction(req, 'VIEW_USER', 'USER', userId)
    sendSuccess(res, details)
  })
)

// --------------------------------------------------------------------------
// POST /:id/suspend — SUPER_ADMIN only
// --------------------------------------------------------------------------

router.post(
  '/:id/suspend',
  requireSuperAdmin,
  validate(suspendUserSchema),
  asyncHandler(async (req, res) => {
    const userId = req.params['id'] as string
    const body = req.body as { reason: string; notes?: string }
    const result = await suspendUser(userId, req.admin!.adminId, body)
    await auditAdminAction(req, 'SUSPEND_USER', 'USER', userId, { reason: body.reason })
    sendSuccess(res, result)
  })
)

// --------------------------------------------------------------------------
// POST /:id/unsuspend — SUPER_ADMIN only
// --------------------------------------------------------------------------

router.post(
  '/:id/unsuspend',
  requireSuperAdmin,
  validate(unsuspendUserSchema),
  asyncHandler(async (req, res) => {
    const userId = req.params['id'] as string
    const body = req.body as { notes?: string }
    const result = await unsuspendUser(userId, req.admin!.adminId, body.notes)
    await auditAdminAction(req, 'UNSUSPEND_USER', 'USER', userId)
    sendSuccess(res, result)
  })
)

// --------------------------------------------------------------------------
// POST /:id/unlock — SUPER_ADMIN only (clears account lockout)
// --------------------------------------------------------------------------

router.post(
  '/:id/unlock',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const userId = req.params['id'] as string
    const result = await unlockUser(userId)
    await auditAdminAction(req, 'UNLOCK_USER', 'USER', userId)
    sendSuccess(res, result)
  })
)

export default router
