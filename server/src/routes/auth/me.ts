import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { auth } from '../../middleware/auth.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import * as authService from '../../services/auth.service.js'

const router = Router()

/**
 * GET /api/auth/me
 * Get current user profile with businesses list and active business.
 */
router.get(
  '/me',
  auth,
  asyncHandler(async (req, res) => {
    const data = await authService.getMe(req.user!.userId, req.user!.businessId)
    if (!data) {
      sendError(res, 'User not found', 'NOT_FOUND', 404)
      return
    }
    res.set('Cache-Control', 'no-store')
    sendSuccess(res, data)
  })
)

export default router
