/**
 * Session management routes — list active devices, force logout.
 * GET /api/sessions — list active sessions
 * DELETE /api/sessions/:id — revoke specific session
 * DELETE /api/sessions/all — revoke all except current
 */

import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { listSessions, revokeSession, revokeAllSessions } from '../services/session.service.js'

const router = Router()

// All routes require authentication
router.use(auth)

/** List active sessions */
router.get('/', asyncHandler(async (req, res) => {
  const sessions = await listSessions(req.user!.userId)
  sendSuccess(res, { sessions })
}))

/** Revoke all sessions except current */
router.delete('/all', asyncHandler(async (req, res) => {
  const count = await revokeAllSessions(req.user!.userId)
  sendSuccess(res, { revoked: count })
}))

/** Revoke a specific session */
router.delete('/:sessionId', asyncHandler(async (req, res) => {
  const success = await revokeSession(req.user!.userId, req.params.sessionId as string)
  if (!success) {
    return sendError(res, 'Session not found', 'NOT_FOUND', 404)
  }
  sendSuccess(res, { revoked: true })
}))

export default router
