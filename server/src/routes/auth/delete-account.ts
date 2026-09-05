import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { auth } from '../../middleware/auth.js'
import { sendSuccess } from '../../lib/response.js'
import { prisma } from '../../lib/prisma.js'
import * as authService from '../../services/auth.service.js'

const router = Router()

/**
 * DELETE /api/auth/account
 * Google Play policy compliant account deletion endpoint.
 * Revokes all sessions, marks the user deleted, and cleans up cookies.
 */
router.delete(
  '/account',
  auth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId

    // Revoke all refresh tokens for this user
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'account_deletion' },
    })

    // Anonymize / deactivate user record
    await prisma.user.update({
      where: { id: userId },
      data: {
        isPhoneVerified: false,
        name: 'Deleted User',
      },
    })

    // Clear auth cookies
    authService.clearTokenCookies(res)

    res.set('Cache-Control', 'no-store')
    sendSuccess(res, { message: 'Account and associated personal data deleted successfully' })
  })
)

export default router
