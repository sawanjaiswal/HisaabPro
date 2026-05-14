/**
 * POST /api/parties/:partyId/invite — authenticated
 *
 * Issues a 7-day invite link for a Party so the party owner can claim their
 * portal. Only users with access to the business that owns the Party may issue.
 *
 * Security:
 *  - requireAuth enforced via parent router (party.ts already applies auth)
 *  - Party must belong to req.user.businessId — tenant-scope enforced in service
 *  - Token plaintext returned once; never stored at rest (A2)
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { issueInvite } from '../../services/party-invite.service.js'

const router = Router({ mergeParams: true })

// ---------------------------------------------------------------------------
// POST /api/parties/:partyId/invite
// ---------------------------------------------------------------------------

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const issuedById = req.user!.userId
    const partyId = req.params['partyId'] as string

    const invite = await issueInvite({ partyId, businessId, issuedById })

    res.status(201).json({
      success: true,
      data: {
        linkId: invite.linkId,
        token: invite.token,
        url: invite.url,
        expiresAt: invite.expiresAt,
      },
      message: 'Invite link created. Share this URL once — it cannot be retrieved again.',
    })
  })
)

export default router
