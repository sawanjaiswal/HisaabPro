/**
 * Admin Business Management Routes
 * GET /api/admin/businesses         — list (paginated)
 * GET /api/admin/businesses/:id     — detail with stats
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { requireAdmin, auditAdminAction } from '../../middleware/admin-auth.js'
import { listBusinessesQuerySchema } from '../../schemas/admin.schemas.js'
import {
  getAllBusinesses,
  getBusinessDetails,
} from '../../services/admin/index.js'
import { sendSuccess, sendPaginated } from '../../lib/response.js'

const router = Router()

// All business routes require admin auth
router.use(requireAdmin)

// --------------------------------------------------------------------------
// GET / — list businesses
// --------------------------------------------------------------------------

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listBusinessesQuerySchema.parse({
      cursor: req.query['cursor'],
      limit: req.query['limit'],
      search: req.query['search'],
      status: req.query['status'],
    })

    const { businesses, nextCursor } = await getAllBusinesses(query)
    sendPaginated(res, businesses, nextCursor)
  })
)

// --------------------------------------------------------------------------
// GET /:id — business detail with stats
// --------------------------------------------------------------------------

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.params['id'] as string
    const details = await getBusinessDetails(businessId)
    await auditAdminAction(req, 'VIEW_BUSINESS', 'BUSINESS', businessId)
    sendSuccess(res, details)
  })
)

export default router
