/**
 * Collections Aging Routes
 *
 * GET /api/collections/aging
 *   Returns full aging summary (4 buckets, top 5 parties, broken PTP count).
 *   Requires: auth + collections.view permission.
 *
 * GET /api/collections/aging/parties?bucket=current|31|61|91&cursor=&limit=
 *   Returns cursor-paginated party list for one bucket.
 *   Requires: auth + collections.view permission.
 */

import { Router } from 'express'
import { z } from 'zod'
import { auth } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permission.js'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { getAgingBuckets, getAgingParties } from '../../services/collections/aging.service.js'

const router = Router()

// All aging routes require authentication + collections.view
router.use(auth)
router.use(requirePermission('collections.view'))

// ─── Validation schemas ──────────────────────────────────────────────────────

const VALID_BUCKETS = ['current', '31', '61', '91'] as const
type BucketParam = typeof VALID_BUCKETS[number]

// Map URL param → internal bucket key
const BUCKET_MAP: Record<BucketParam, 'current' | 'bucket_31' | 'bucket_61' | 'bucket_91'> = {
  current:   'current',
  '31':      'bucket_31',
  '61':      'bucket_61',
  '91':      'bucket_91',
}

const partiesQuerySchema = z.object({
  bucket: z.enum(VALID_BUCKETS, {
    errorMap: () => ({ message: 'bucket must be one of: current, 31, 61, 91' }),
  }),
  cursor: z.string().optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
})

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/collections/aging
 * Full aging summary scoped to authenticated user's business.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const data = await getAgingBuckets(businessId)
    sendSuccess(res, data)
  })
)

/**
 * GET /api/collections/aging/parties
 * Cursor-paginated party list for one aging bucket.
 */
router.get(
  '/parties',
  asyncHandler(async (req, res) => {
    const parsed = partiesQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      sendError(res, parsed.error.errors[0]?.message ?? 'Invalid query', 'INVALID_BUCKET', 400)
      return
    }

    const { bucket, cursor, limit } = parsed.data
    const internalBucket = BUCKET_MAP[bucket]
    const businessId = req.user!.businessId

    const result = await getAgingParties(businessId, internalBucket, cursor, limit)
    sendSuccess(res, result)
  })
)

export default router
