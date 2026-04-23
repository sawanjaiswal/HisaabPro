import { Router } from 'express'
import { randomUUID } from 'crypto'
import { sendSuccess } from '../../lib/response.js'
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_COOKIE_TTL_MS,
} from '../../config/security.js'

const router = Router()

/**
 * GET /api/auth/csrf-token
 * Issue a CSRF token via httpOnly cookie + response body.
 * Frontend reads token from body, stores in memory, sends as X-CSRF-Token header.
 */
router.get('/csrf-token', (req, res) => {
  const existing = req.cookies?.[CSRF_COOKIE_NAME] as string | undefined
  const token = existing ?? randomUUID()

  if (!existing) {
    const isProduction = process.env.NODE_ENV === 'production'
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: CSRF_COOKIE_TTL_MS,
    })
  }

  res.set(CSRF_HEADER_NAME, token)
  sendSuccess(res, { csrfToken: token })
})

export default router
