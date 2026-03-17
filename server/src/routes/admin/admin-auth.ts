/**
 * Admin Auth Routes
 * POST /api/admin/auth/login
 * POST /api/admin/auth/refresh
 * POST /api/admin/auth/logout
 * GET  /api/admin/auth/me
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { requireAdmin, auditAdminAction } from '../../middleware/admin-auth.js'
import {
  adminLoginSchema,
  adminRefreshSchema,
} from '../../schemas/admin.schemas.js'
import {
  adminLogin,
  getAdminProfile,
  refreshAdminToken,
} from '../../services/admin/index.js'
import { sendSuccess } from '../../lib/response.js'
import { authRateLimiter } from '../../middleware/rate-limit.js'

const router = Router()

// --------------------------------------------------------------------------
// POST /login — email + password → tokens
// --------------------------------------------------------------------------

router.post(
  '/login',
  authRateLimiter,
  validate(adminLoginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string }
    const result = await adminLogin(email, password)
    sendSuccess(res, result)
  })
)

// --------------------------------------------------------------------------
// POST /refresh — swap refresh token for new access token
// --------------------------------------------------------------------------

router.post(
  '/refresh',
  validate(adminRefreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as { refreshToken: string }
    const tokens = await refreshAdminToken(refreshToken)
    sendSuccess(res, tokens)
  })
)

// --------------------------------------------------------------------------
// POST /logout — audit and return 200 (client discards token)
// --------------------------------------------------------------------------

router.post(
  '/logout',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await auditAdminAction(req, 'LOGOUT')
    sendSuccess(res, { message: 'Logged out successfully' })
  })
)

// --------------------------------------------------------------------------
// GET /me — current admin profile
// --------------------------------------------------------------------------

router.get(
  '/me',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const profile = await getAdminProfile(req.admin!.adminId)
    sendSuccess(res, profile)
  })
)

export default router
