/**
 * Public router — mounted at /api/p BEFORE global auth/CSRF stack.
 *
 * Mount order in app.ts:
 *   helmet → cors → compression
 *   → publicRouter  (/api/p)          ← this file
 *   → express.json + cookieParser
 *   → apiRateLimiter → csrfProtection → ...
 *   → mountFeatureRoutes()
 *
 * Rules for this router:
 *   - No requireAuth / no cookie reads / no cookie writes (except invite-claim)
 *   - CSRF NOT applied (no session context; token IS the credential)
 *   - Every `:token` handler calls resolvePublicToken() first — no inline checks
 */

import express, { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { publicRateLimiter } from '../middleware/public/rate-limit.js'
import { resolvePublicToken, PublicLinkError } from '../middleware/resolve-public-token.js'
import invoiceRoutes from './public/invoice.routes.js'
import storeRoutes from './public/store.routes.js'
import inviteRoutes from './public/invite.routes.js'

const router = Router()

// Tighter body-size limit for public endpoints (architecture §4)
router.use(express.json({ limit: '256kb' }))

// ---------------------------------------------------------------------------
// GET /api/p/health
// ---------------------------------------------------------------------------

router.get(
  '/health',
  publicRateLimiter('health'),
  asyncHandler(async (_req, res) => {
    res.status(200).json({ ok: true })
  })
)

// ---------------------------------------------------------------------------
// Dev-only resolver smoke-test endpoint
// Allows testing resolvePublicToken without any resource handler in place.
// Mounted ONLY when NODE_ENV !== 'production'.
// ---------------------------------------------------------------------------

if (process.env.NODE_ENV !== 'production') {
  router.get(
    '/__resolver-test/:token',
    asyncHandler(async (req, res, next) => {
      try {
        // Exercise the middleware logic directly
        const invoiceMiddleware = resolvePublicToken('INVOICE')
        await new Promise<void>((resolve, reject) => {
          invoiceMiddleware(req, res, (err?: unknown) => {
            if (err) reject(err)
            else resolve()
          })
        })
        if (res.headersSent) return // middleware already responded (error case)
        res.status(200).json({ success: true, data: { linkId: req.publicLink?.id } })
      } catch (err) {
        if (err instanceof PublicLinkError) {
          res.status(err.httpStatus).json({
            success: false,
            error: { code: err.code },
          })
          return
        }
        next(err)
      }
    })
  )
}

// ---------------------------------------------------------------------------
// Sub-routers for later PRs
// ---------------------------------------------------------------------------

router.use('/invoice', invoiceRoutes)

// PR4 — Online Storefront (#121)
router.use('/store', storeRoutes)

// PR5 — Party Invite Portal (#131)
router.use('/invite', inviteRoutes)

export default router
