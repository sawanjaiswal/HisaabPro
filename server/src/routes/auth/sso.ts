import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { authRateLimiter } from '../../middleware/rate-limit.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { prisma } from '../../lib/prisma.js'
import { generateTokens } from '../../lib/jwt.js'
import { setTokenCookies } from '../../services/auth/tokens.js'
import { getMe } from '../../services/auth/me.js'
import { persistRefreshTokenFamily, resolveUserBusinessId } from '../../services/auth/helpers.js'
import logger from '../../lib/logger.js'
import { z } from 'zod'
import crypto from 'crypto'

const googleExchangeSchema = z
  .object({
    idToken: z.string().optional(),
    accessToken: z.string().optional(),
  })
  .refine((data) => Boolean(data.idToken || data.accessToken), {
    message: 'Valid Google token is required',
  })

const router = Router()

/**
 * GET /api/auth/sso/google/config
 * Returns Google OAuth client ID for web authentication.
 */
router.get(
  '/sso/google/config',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, {
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || null,
    })
  })
)

/**
 * POST /api/auth/sso/google/start-native
 */
router.post(
  '/sso/google/start-native',
  authRateLimiter,
  asyncHandler(async (_req, res) => {
    const nonce = crypto.randomBytes(16).toString('hex')
    const sealedTx = crypto.randomBytes(24).toString('hex')
    sendSuccess(res, {
      sealedTx,
      nonce,
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || null,
    })
  })
)

/**
 * Verify Google ID token or Access token directly with Google OAuth2 APIs.
 */
async function verifyGoogleTokenWithGoogle(token: string): Promise<{
  email: string
  name: string
  picture?: string
  sub: string
} | null> {
  // 1. Try Google ID Token verification
  try {
    const idTokenUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`
    const idRes = await fetch(idTokenUrl, { method: 'GET' })
    if (idRes.ok) {
      const data = await idRes.json() as {
        email?: string
        email_verified?: string | boolean
        name?: string
        picture?: string
        sub?: string
        aud?: string
      }

      const isVerified = data.email_verified === true || data.email_verified === 'true'
      if (data.email && isVerified && data.sub) {
        return {
          email: data.email.toLowerCase().trim(),
          name: data.name || data.email.split('@')[0] || 'Google User',
          picture: data.picture,
          sub: data.sub,
        }
      }
    }
  } catch (err) {
    logger.warn('sso.google_id_token_verify_failed', { error: err instanceof Error ? err.message : String(err) })
  }

  // 2. Try Google UserInfo endpoint (if token is an access token)
  try {
    const userinfoUrl = 'https://www.googleapis.com/oauth2/v3/userinfo'
    const infoRes = await fetch(userinfoUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (infoRes.ok) {
      const data = await infoRes.json() as {
        email?: string
        email_verified?: boolean
        name?: string
        picture?: string
        sub?: string
      }

      if (data.email && (data.email_verified === true || data.email_verified === undefined) && data.sub) {
        return {
          email: data.email.toLowerCase().trim(),
          name: data.name || data.email.split('@')[0] || 'Google User',
          picture: data.picture,
          sub: data.sub,
        }
      }
    }
  } catch (err) {
    logger.warn('sso.google_userinfo_verify_failed', { error: err instanceof Error ? err.message : String(err) })
  }

  return null
}

/**
 * POST /api/auth/sso/google/exchange-native
 * POST /api/auth/google
 */
async function handleGoogleExchange(req: any, res: any) {
  const parsed = googleExchangeSchema.safeParse(req.body)
  if (!parsed.success) {
    sendError(res, 'Valid Google token is required', 'VALIDATION_ERROR', 400)
    return
  }

  const { idToken, accessToken } = parsed.data
  const tokenToVerify = (idToken || accessToken) as string

  // Cryptographically verify Google token with Google's API
  const googleProfile = await verifyGoogleTokenWithGoogle(tokenToVerify)

  if (!googleProfile || !googleProfile.email) {
    logger.warn('sso.google_rejected_invalid_token', { ip: req.ip })
    sendError(res, 'Google authentication failed: invalid or unverified Google account. Please try signing in again.', 'INVALID_GOOGLE_TOKEN', 401)
    return
  }

  const { email, name } = googleProfile

  try {
    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { phone: email.toLowerCase() },
        ],
      },
    })

    let businessId = ''
    let tokens: { accessToken: string; refreshToken: string }
    let isNewUser = false
    let currentUser: { id: string; phone: string; name: string | null; email: string | null }

    if (!user) {
      isNewUser = true
      let placeholderPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`
      while (await prisma.user.findUnique({ where: { phone: placeholderPhone } })) {
        placeholderPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`
      }
      const { createUserWithDefaultBusiness } = await import('../../services/auth/register.js')
      const created = await createUserWithDefaultBusiness({
        phone: placeholderPhone,
        name,
        email: email.toLowerCase(),
        passwordHash: null,
        businessName: `${name}'s Business`,
      })
      currentUser = created.user
      businessId = created.business.id
      tokens = created.tokens
    } else {
      currentUser = user
      businessId = await resolveUserBusinessId(user.id)
      if (!businessId) {
        const business = await prisma.business.create({
          data: {
            name: `${user.name || 'My'}'s Business`,
            phone: user.phone,
            businessType: 'general',
            currencyCode: 'INR',
          },
        })
        await prisma.businessUser.create({
          data: {
            userId: user.id,
            businessId: business.id,
            role: 'owner',
            status: 'ACTIVE',
            isActive: true,
          },
        })
        await prisma.user.update({
          where: { id: user.id },
          data: { lastActiveBusinessId: business.id },
        })
        const { ensureSystemRoles } = await import('../../services/settings.service.js')
        const { seedDefaultAccounts } = await import('../../services/accounting/chart-of-accounts.js')
        const { ensurePredefinedUnits } = await import('../../services/unit/constants.js')
        await ensureSystemRoles(business.id)
        await seedDefaultAccounts(business.id)
        await ensurePredefinedUnits(business.id)
        businessId = business.id
      }
      tokens = generateTokens(user.id, user.phone, businessId)
    }

    await persistRefreshTokenFamily({
      userId: currentUser.id,
      refreshToken: tokens.refreshToken,
      deviceInfo: req.headers['user-agent']?.slice(0, 200) || null,
    })

    setTokenCookies(res, tokens)
    res.set('Cache-Control', 'no-store')

    const meData = await getMe(currentUser.id, businessId)

    sendSuccess(res, {
      isNewUser,
      user: meData?.user ?? {
        id: currentUser.id,
        phone: currentUser.phone,
        name: currentUser.name,
        email: currentUser.email,
        businessId,
        role: 'owner',
      },
      businesses: meData?.businesses ?? [],
      activeBusiness: meData?.activeBusiness ?? null,
      tokens,
    })
  } catch (err) {
    logger.error('sso.google_auth_error', { error: err instanceof Error ? err.message : String(err) })
    sendError(res, 'Failed to complete Google authentication', 'SSO_FAILED', 500)
  }
}

router.post('/sso/google/exchange-native', authRateLimiter, asyncHandler(handleGoogleExchange))
router.post('/google', authRateLimiter, asyncHandler(handleGoogleExchange))

export default router
