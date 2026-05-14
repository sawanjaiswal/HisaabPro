/**
 * Public invite routes — mounted at /api/p/invite
 *
 * GET  /:token              — preview (no claim, no PII)
 * POST /:token/otp/send     — trigger OTP to party's phone (existing-user branch)
 * POST /:token/otp/verify   — verify OTP, mint otpVerifiedToken (5-min)
 * POST /:token/claim        — atomic claim (consumes link, binds Party.userId)
 *
 * Security invariants:
 *   - resolvePublicToken('INVITE') is the FIRST operation in every /:token handler
 *   - GET preview does NOT consume the link (multiple previews allowed)
 *   - Claim requires otpVerifiedToken for existing-user branch (F2)
 *   - Atomic updateMany in claimInvite prevents double-claim races (A5)
 *   - Token IS the credential — no requireAuth, no cookies except on successful claim
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { publicRateLimiter } from '../../middleware/public/rate-limit.js'
import { resolvePublicTokenHelper } from '../../middleware/resolve-public-token.js'
import { prisma } from '../../lib/prisma.js'
import { validate } from '../../middleware/validate.js'
import { sanitizeInvitePreview } from '../../services/sanitize-invite-public.js'
import { sendInviteOtp, verifyInviteOtp } from '../../services/invite-otp.service.js'
import { claimBodySchema, inviteOtpVerifyBodySchema } from '../../validators/invite.validators.js'
import { sha256, handlePublicLinkError } from './invite/helpers.js'
import { claimHandler } from './invite/claim.handler.js'

const router = Router()

router.get(
  '/:token',
  publicRateLimiter('invite'),
  asyncHandler(async (req, res, next) => {
    let link: import('@prisma/client').SharedLink
    try {
      link = await resolvePublicTokenHelper(req, 'INVITE')
    } catch (err) {
      if (handlePublicLinkError(err, res)) return
      return next(err)
    }

    const party = await prisma.party.findFirst({
      where: { id: link.resourceId, businessId: link.businessId, isDeleted: false },
      select: { name: true, phone: true },
    })

    const business = await prisma.business.findUnique({
      where: { id: link.businessId },
      select: { name: true },
    })

    if (!party || !business) {
      res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Invite resource not found' },
      })
      return
    }

    let existingUser = false
    if (party.phone) {
      const user = await prisma.user.findUnique({
        where: { phone: party.phone },
        select: { id: true },
      })
      existingUser = user !== null
    }

    const dto = sanitizeInvitePreview(link, party, business, existingUser)
    res.status(200).json({ success: true, data: dto })
  })
)

router.post(
  '/:token/otp/send',
  publicRateLimiter('invite'),
  asyncHandler(async (req, res, next) => {
    let link: import('@prisma/client').SharedLink
    try {
      link = await resolvePublicTokenHelper(req, 'INVITE')
    } catch (err) {
      if (handlePublicLinkError(err, res)) return
      return next(err)
    }

    const party = await prisma.party.findFirst({
      where: { id: link.resourceId, businessId: link.businessId, isDeleted: false },
      select: { phone: true },
    })

    if (!party?.phone) {
      res.status(422).json({
        success: false,
        error: { code: 'NO_PHONE', message: 'Party has no phone number on file — cannot send OTP' },
      })
      return
    }

    const existingUser = await prisma.user.findUnique({
      where: { phone: party.phone },
      select: { id: true },
    })

    if (!existingUser) {
      res.status(422).json({
        success: false,
        error: { code: 'OTP_NOT_REQUIRED', message: 'Use the signup flow for new users' },
      })
      return
    }

    const tokenHash = sha256(req.params['token'] as string)
    const result = await sendInviteOtp({ phone: party.phone, tokenHash })

    if (!result.sent) {
      res.status(429).json({
        success: false,
        error: { code: 'OTP_COOLDOWN', message: result.message },
      })
      return
    }

    res.status(200).json({
      success: true,
      data: { expiresIn: 300 },
      message: result.message,
    })
  })
)

router.post(
  '/:token/otp/verify',
  publicRateLimiter('invite'),
  validate(inviteOtpVerifyBodySchema),
  asyncHandler(async (req, res, next) => {
    let link: import('@prisma/client').SharedLink
    try {
      link = await resolvePublicTokenHelper(req, 'INVITE')
    } catch (err) {
      if (handlePublicLinkError(err, res)) return
      return next(err)
    }

    const party = await prisma.party.findFirst({
      where: { id: link.resourceId, businessId: link.businessId, isDeleted: false },
      select: { phone: true },
    })

    if (!party?.phone) {
      res.status(422).json({
        success: false,
        error: { code: 'NO_PHONE', message: 'Party has no phone number on file' },
      })
      return
    }

    const { code } = req.body as { code: string }
    const tokenHash = sha256(req.params['token'] as string)
    const result = await verifyInviteOtp({ phone: party.phone, code, tokenHash })

    if (!result.verified) {
      res.status(400).json({
        success: false,
        error: { code: 'OTP_INVALID', message: result.message },
      })
      return
    }

    res.status(200).json({
      success: true,
      data: { otpVerifiedToken: result.otpVerifiedToken },
      message: 'OTP verified',
    })
  })
)

router.post(
  '/:token/claim',
  publicRateLimiter('claim'),
  validate(claimBodySchema),
  asyncHandler(claimHandler)
)

export default router
