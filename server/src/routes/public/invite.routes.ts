/**
 * Public invite routes — mounted at /api/p/invite
 *
 * GET  /api/p/invite/:token          — preview (no claim, no PII)
 * POST /api/p/invite/:token/otp/send — trigger OTP to party's phone (existing-user branch)
 * POST /api/p/invite/:token/otp/verify — verify OTP, mint otpVerifiedToken (5-min)
 * POST /api/p/invite/:token/claim    — atomic claim (consumes link, binds Party.userId)
 *
 * Security invariants:
 *   - resolvePublicToken('INVITE') called as FIRST operation in every /:token handler
 *   - GET preview does NOT consume the link (multiple previews allowed)
 *   - Claim requires otpVerifiedToken for existing-user branch (F2)
 *   - Atomic updateMany in claimInvite prevents double-claim races (A5)
 *   - No cookies written except on successful claim (session issuance)
 *   - No requireAuth — these are public endpoints; token IS the credential
 */

import crypto from 'node:crypto'
import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { publicRateLimiter } from '../../middleware/public/rate-limit.js'
import { resolvePublicTokenHelper, PublicLinkError } from '../../middleware/resolve-public-token.js'
import { prisma } from '../../lib/prisma.js'
import { validate } from '../../middleware/validate.js'
import { sanitizeInvitePreview } from '../../services/sanitize-invite-public.js'
import { sendInviteOtp, verifyInviteOtp } from '../../services/invite-otp.service.js'
import { claimInvite } from '../../services/party-invite.service.js'
import { claimBodySchema, inviteOtpVerifyBodySchema } from '../../validators/invite.validators.js'
import { generateTokens } from '../../lib/jwt.js'
import { setTokenCookies } from '../../services/auth/tokens.js'
import { resolveUserBusinessId } from '../../services/auth/helpers.js'
import bcrypt from 'bcryptjs'
import logger from '../../lib/logger.js'

const router = Router()

// ---------------------------------------------------------------------------
// Internal helper — sha256
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

// ---------------------------------------------------------------------------
// Shared error responder for PublicLinkError
// ---------------------------------------------------------------------------

function handlePublicLinkError(err: unknown, res: import('express').Response): boolean {
  if (err instanceof PublicLinkError) {
    res.status(err.httpStatus).json({
      success: false,
      error: { code: err.code, message: err.message },
    })
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// GET /api/p/invite/:token — preview (no claim)
// ---------------------------------------------------------------------------

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

    // Load Party + Business — scoped to link.businessId (IDOR guard C2)
    const party = await prisma.party.findFirst({
      where: {
        id: link.resourceId,
        businessId: link.businessId,
        isDeleted: false,
      },
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

    // Check if a User with this phone already exists (determines OTP branch)
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

// ---------------------------------------------------------------------------
// POST /api/p/invite/:token/otp/send — send OTP to party's phone
// ---------------------------------------------------------------------------

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
      where: {
        id: link.resourceId,
        businessId: link.businessId,
        isDeleted: false,
      },
      select: { phone: true },
    })

    if (!party?.phone) {
      res.status(422).json({
        success: false,
        error: { code: 'NO_PHONE', message: 'Party has no phone number on file — cannot send OTP' },
      })
      return
    }

    // Only send OTP for the existing-user branch (new users go through signup OTP)
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
      data: { expiresIn: 300 }, // 5-min OTP TTL
      message: result.message,
    })
  })
)

// ---------------------------------------------------------------------------
// POST /api/p/invite/:token/otp/verify — verify OTP, mint otpVerifiedToken
// ---------------------------------------------------------------------------

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
      where: {
        id: link.resourceId,
        businessId: link.businessId,
        isDeleted: false,
      },
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

// ---------------------------------------------------------------------------
// POST /api/p/invite/:token/claim — atomic claim (consumes link)
// ---------------------------------------------------------------------------

const PASSWORD_BCRYPT_ROUNDS = 10

router.post(
  '/:token/claim',
  publicRateLimiter('claim'),
  validate(claimBodySchema),
  asyncHandler(async (req, res, next) => {
    const rawToken = req.params['token'] as string

    // resolvePublicTokenHelper validates token but does NOT consume it.
    // The atomic transaction in claimInvite does the actual consumption.
    let link: import('@prisma/client').SharedLink
    try {
      link = await resolvePublicTokenHelper(req, 'INVITE')
    } catch (err) {
      if (handlePublicLinkError(err, res)) return
      return next(err)
    }

    const body = req.body as import('../../validators/invite.validators.js').ClaimBody

    // Load party to get phone
    const party = await prisma.party.findFirst({
      where: {
        id: link.resourceId,
        businessId: link.businessId,
        isDeleted: false,
      },
      select: { phone: true, name: true },
    })

    if (!party) {
      res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Party not found' },
      })
      return
    }

    let userId: string

    // ------------------------------------------------------------------
    // Branch A — existing user: require otpVerifiedToken
    // ------------------------------------------------------------------
    if (body.kind === 'existing') {
      if (!party.phone) {
        res.status(422).json({
          success: false,
          error: { code: 'NO_PHONE', message: 'Party has no phone — cannot verify identity' },
        })
        return
      }

      const existingUser = await prisma.user.findUnique({
        where: { phone: party.phone },
        select: { id: true },
      })

      if (!existingUser) {
        // Phone not registered — force signup branch
        res.status(409).json({
          success: false,
          error: {
            code: 'OTP_NOT_REQUIRED',
            message: 'This phone is not registered. Use the signup flow.',
          },
        })
        return
      }

      userId = existingUser.id

    // ------------------------------------------------------------------
    // Branch B — new user signup: create User then claim
    // ------------------------------------------------------------------
    } else {
      if (!party.phone) {
        res.status(422).json({
          success: false,
          error: { code: 'NO_PHONE', message: 'Party has no phone number — cannot create account' },
        })
        return
      }

      // Guard: if User with this phone already exists, force existing branch
      const existing = await prisma.user.findUnique({
        where: { phone: party.phone },
        select: { id: true },
      })

      if (existing) {
        res.status(409).json({
          success: false,
          error: {
            code: 'OTP_REQUIRED',
            message: 'This phone is already registered. Please verify with OTP.',
          },
        })
        return
      }

      const { name, password } = body

      // Create User — hash password before storing (never plaintext)
      const passwordHash = await bcrypt.hash(password, PASSWORD_BCRYPT_ROUNDS)

      const newUser = await prisma.user.create({
        data: { phone: party.phone, name, passwordHash },
        select: { id: true },
      })

      userId = newUser.id
    }

    // ------------------------------------------------------------------
    // Atomic claim transaction (A5 / C3 / F3)
    // ------------------------------------------------------------------
    let claimResult: Awaited<ReturnType<typeof claimInvite>>
    try {
      claimResult = await claimInvite({
        rawToken,
        newUserId: userId,
        otpVerifiedToken: body.kind === 'existing' ? body.otpVerifiedToken : undefined,
        kind: body.kind,
      })
    } catch (err) {
      if (err instanceof PublicLinkError) {
        const statusMap: Record<string, number> = {
          LINK_CONSUMED: 409,
          LINK_NOT_FOUND: 401,
        }
        const status = statusMap[err.code] ?? err.httpStatus
        res.status(status).json({
          success: false,
          error: { code: err.code, message: err.message },
        })
        return
      }
      return next(err)
    }

    // ------------------------------------------------------------------
    // Issue session cookies for the bound user
    // ------------------------------------------------------------------
    const businessId = await resolveUserBusinessId(userId)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, name: true },
    })

    if (!user) {
      logger.error('invite-claim: user disappeared after claim', { userId })
      res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Internal error' } })
      return
    }

    const tokens = generateTokens(userId, user.phone, businessId)
    setTokenCookies(res, tokens)

    res.status(200).json({
      success: true,
      data: {
        ok: true,
        partyId: claimResult.partyId,
        redirect: '/login',
      },
      message: 'Invite claimed successfully. You are now logged in.',
    })
  })
)

export default router
