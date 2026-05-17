/**
 * Party CRM sub-router (#127) — tag aggregation, follow-up queue, narrow patch.
 *
 * Mounted by the parent router AFTER its `router.use(auth)` middleware so
 * every handler below trusts `req.user.businessId`. Literal paths (`/tags`,
 * `/follow-ups`) come first in the parent so the dynamic `/:id` route does
 * NOT swallow them. The narrow PATCH (`/:id`) only carries followUpAt + tags
 * — `.strict()` Zod rejects server-only fields (M2 / architecture §3.6).
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { requirePermission } from '../../middleware/permission.js'
import { sendSuccess } from '../../lib/response.js'
import {
  partyPatchSchema,
  followUpsQuerySchema,
} from '../../schemas/party.schemas.js'
import * as partyService from '../../services/party.service.js'

const router = Router()

// ─── GET /api/parties/tags ─────────────────────────────────────────────────
router.get(
  '/tags',
  requirePermission('parties.view'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await partyService.listTagSummary(businessId)
    sendSuccess(res, result)
  }),
)

// ─── GET /api/parties/follow-ups ───────────────────────────────────────────
// M3 — Zod cap at 365; service-layer defensive clamp inside getFollowUpsDue.
router.get(
  '/follow-ups',
  requirePermission('parties.view'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const parsed = followUpsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_WITHIN_DAYS_RANGE',
          message: parsed.error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', '),
        },
      })
      return
    }
    const result = await partyService.getFollowUpsDue(businessId, parsed.data)
    sendSuccess(res, result)
  }),
)

// ─── PATCH /api/parties/:id ────────────────────────────────────────────────
// M2 — Pattern B `.strict()` rejects server-only fields with VALIDATION_ERROR.
// INVALID_FOLLOWUP_PAST guards `followUpAt` against past timestamps server-side.
router.patch(
  '/:id',
  requirePermission('parties.edit'),
  validate(partyPatchSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    if (req.body.followUpAt) {
      const followUpDate = new Date(req.body.followUpAt)
      if (Number.isFinite(followUpDate.getTime()) && followUpDate.getTime() <= Date.now()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FOLLOWUP_PAST',
            message: 'followUpAt must be a future timestamp',
          },
        })
        return
      }
    }
    const party = await partyService.patchParty(
      businessId,
      String(req.params.id),
      req.body,
    )
    sendSuccess(res, { party })
  }),
)

export default router
