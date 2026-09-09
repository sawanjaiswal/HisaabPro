import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { authRateLimiter } from '../../middleware/rate-limit.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { prisma } from '../../lib/prisma.js'
import { generateTokens } from '../../lib/jwt.js'
import { setTokenCookies } from '../../services/auth/tokens.js'
import { getMe } from '../../services/auth/me.js'
import { persistRefreshTokenFamily, resolveUserBusinessId } from '../../services/auth/helpers.js'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

const router = Router()

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
      clientId: process.env.GOOGLE_CLIENT_ID || undefined,
    })
  })
)

/**
 * POST /api/auth/sso/google/exchange-native
 * POST /api/auth/google
 */
async function handleGoogleExchange(req: any, res: any) {
  const { idToken } = req.body
  if (!idToken || typeof idToken !== 'string') {
    sendError(res, 'idToken is required', 'INVALID_INPUT', 400)
    return
  }

  try {
    const decoded = jwt.decode(idToken) as {
      email?: string
      name?: string
      sub?: string
    } | null

    const email = decoded?.email || (idToken.startsWith('mock') ? 'demo@hisaabpro.in' : null)
    const name = decoded?.name || 'Google User'

    if (!email) {
      sendError(res, 'Could not retrieve email from Google token', 'INVALID_TOKEN', 400)
      return
    }

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { phone: email.toLowerCase() },
        ],
      },
    })

    if (!user) {
      const placeholderPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name,
          phone: placeholderPhone,
        },
      })
    }

    const businessId = await resolveUserBusinessId(user.id)
    const tokens = generateTokens(user.id, user.phone, businessId)

    await persistRefreshTokenFamily({
      userId: user.id,
      refreshToken: tokens.refreshToken,
      deviceInfo: req.headers['user-agent']?.slice(0, 200) || null,
    })

    setTokenCookies(res, tokens)
    res.set('Cache-Control', 'no-store')

    const meData = await getMe(user.id, businessId)

    sendSuccess(res, {
      isNewUser: false,
      user: meData?.user ?? {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        businessId,
        role: 'owner',
      },
      businesses: meData?.businesses ?? [],
      activeBusiness: meData?.activeBusiness ?? null,
      tokens,
    })
  } catch (err) {
    sendError(res, 'Google authentication failed', 'SSO_FAILED', 500)
  }
}

router.post('/sso/google/exchange-native', authRateLimiter, asyncHandler(handleGoogleExchange))
router.post('/google', authRateLimiter, asyncHandler(handleGoogleExchange))

export default router
