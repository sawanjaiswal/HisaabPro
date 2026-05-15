import type { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../../../lib/prisma.js'
import { resolvePublicTokenHelper, PublicLinkError } from '../../../middleware/resolve-public-token.js'
import { claimInvite } from '../../../services/party-invite.service.js'
import { generateTokens } from '../../../lib/jwt.js'
import { setTokenCookies } from '../../../services/auth/tokens.js'
import { resolveUserBusinessId } from '../../../services/auth/helpers.js'
import logger from '../../../lib/logger.js'
import type { ClaimBody } from '../../../validators/invite.validators.js'
import { handlePublicLinkError } from './helpers.js'

// P3.11 — OWASP 2026 minimum (target ≥ 250ms per hash on commodity hw)
const PASSWORD_BCRYPT_ROUNDS = 12

export async function claimHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const rawToken = req.params['token'] as string

  let link: import('@prisma/client').SharedLink
  try {
    link = await resolvePublicTokenHelper(req, 'INVITE')
  } catch (err) {
    if (handlePublicLinkError(err, res)) return
    return next(err)
  }

  const body = req.body as ClaimBody

  const party = await prisma.party.findFirst({
    where: { id: link.resourceId, businessId: link.businessId, isDeleted: false },
    select: { phone: true, name: true },
  })

  if (!party) {
    res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Party not found' },
    })
    return
  }

  if (!party.phone) {
    res.status(422).json({
      success: false,
      error: { code: 'NO_PHONE', message: 'Party has no phone — cannot complete claim' },
    })
    return
  }

  let userId: string

  if (body.kind === 'existing') {
    const existingUser = await prisma.user.findUnique({
      where: { phone: party.phone },
      select: { id: true },
    })

    if (!existingUser) {
      res.status(409).json({
        success: false,
        error: { code: 'OTP_NOT_REQUIRED', message: 'This phone is not registered. Use the signup flow.' },
      })
      return
    }

    userId = existingUser.id
  } else {
    const existing = await prisma.user.findUnique({
      where: { phone: party.phone },
      select: { id: true },
    })

    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'OTP_REQUIRED', message: 'This phone is already registered. Please verify with OTP.' },
      })
      return
    }

    const { name, password } = body
    const passwordHash = await bcrypt.hash(password, PASSWORD_BCRYPT_ROUNDS)
    const newUser = await prisma.user.create({
      data: { phone: party.phone, name, passwordHash },
      select: { id: true },
    })
    userId = newUser.id
  }

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
      const statusMap: Record<string, number> = { LINK_CONSUMED: 409, LINK_NOT_FOUND: 401 }
      const status = statusMap[err.code] ?? err.httpStatus
      res.status(status).json({
        success: false,
        error: { code: err.code, message: err.message },
      })
      return
    }
    return next(err)
  }

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
    data: { ok: true, partyId: claimResult.partyId, redirect: '/login' },
    message: 'Invite claimed successfully. You are now logged in.',
  })
}
