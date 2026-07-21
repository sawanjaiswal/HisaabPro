/**
 * Shadow-harness status endpoint (File #38, ARCHITECTURE §8.2, §8.3).
 *
 *   GET /api/admin/scoped-shadow/status  — platform admin only
 *
 * The one operator-facing surface of this epic. It is what turns "the cutover is
 * safe" from an assertion into a number an operator can read, so its failure
 * modes matter more than its happy path:
 *
 *   - `404 SHADOW_DISABLED` when the mode is not `shadow`, NOT an empty 200. An
 *     all-zero payload from a harness that was never installed is
 *     indistinguishable from a harness that observed nothing — and this epic
 *     exists because a component that "grepped clean" was never called. The mode
 *     check makes absence loud.
 *   - The read is audited like every other admin data access. The payload holds
 *     hashed tenant ids and up to 50 × 40 row ids from across the platform; that
 *     is a cross-tenant read by any reasonable definition, and it leaves a row.
 */
import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { requireAdmin, auditAdminAction } from '../../middleware/admin-auth.js'
import { getScopedPrismaMode } from '../../lib/env.scoped-prisma.js'
import { getShadowStatus } from '../../services/shadow/shadow-status.service.js'
import { sendSuccess, sendError } from '../../lib/response.js'

const router = Router()

router.use(requireAdmin)

router.get(
  '/status',
  asyncHandler(async (req, res) => {
    if (getScopedPrismaMode() !== 'shadow') {
      sendError(res, 'Shadow mode is not enabled', 'SHADOW_DISABLED', 404)
      return
    }

    const status = await getShadowStatus()

    // After the read, not before: an audit row for a request that then 500s would
    // claim an access that never produced data.
    await auditAdminAction(req, 'VIEW_SCOPED_SHADOW_STATUS', 'SYSTEM', 'scoped-shadow', {
      windowHours: status.windowHours,
      recentRows: status.recent.length,
    })

    sendSuccess(res, status)
  }),
)

export default router
