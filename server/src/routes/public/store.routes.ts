/**
 * Public storefront route — GET /api/p/store/:slug
 *
 * PR4 #121 — slug-based lookup, no token resolver needed.
 *
 * Security invariants:
 *  - No requireAuth / no cookie reads / no cookie writes.
 *  - 404 returned for both "slug not found" and "store not public"
 *    (no oracle distinguishing the two cases to the public).
 *  - Response built via sanitizeStorefrontForPublic() — no Prisma spread.
 *  - storefrontRateLimit applied (pub:store:<ip> bucket, 120/min).
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { publicRateLimiter } from '../../middleware/public/rate-limit.js'
import { getPublicStorefront } from '../../services/storefront.service.js'
import { sanitizeStorefrontForPublic } from '../../services/sanitize-storefront-public.js'

const router = Router()

// ---------------------------------------------------------------------------
// GET /api/p/store/:slug
// ---------------------------------------------------------------------------

router.get(
  '/:slug',
  publicRateLimiter('store'),
  asyncHandler(async (req, res) => {
    const slug = req.params['slug'] as string

    // Reject slugs that are obviously invalid before hitting the DB
    if (!slug || slug.length > 64) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } })
      return
    }

    const data = await getPublicStorefront(slug)

    if (!data) {
      // Return same 404 whether slug doesn't exist or store is not public
      // (no oracle for "this slug exists but store is private")
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } })
      return
    }

    const payload = sanitizeStorefrontForPublic(data.business, data.products)
    res.status(200).json({ success: true, data: payload })
  })
)

export default router
