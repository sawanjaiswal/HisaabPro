/**
 * Biometric Auth Routes — Feature #59
 *
 * WebAuthn/FIDO2 credential registration and authentication.
 * Mounted at /api/auth/biometric
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { generateTokens } from '../lib/jwt.js'
import * as authService from '../services/auth.service.js'
import * as webauthnService from '../services/webauthn.service.js'
import logger from '../lib/logger.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

// ---------------------------------------------------------------------------
// Registration — requires authenticated user
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/biometric/register/options
 * Generate a WebAuthn registration challenge.
 */
router.post(
  '/register/options',
  auth,
  asyncHandler(async (req, res) => {
    const { userId, phone } = req.user!
    const options = webauthnService.generateRegistrationOptions(userId, phone)
    sendSuccess(res, { options })
  })
)

/**
 * POST /api/auth/biometric/register/verify
 * Verify attestation and store the credential.
 * Body: { credentialId, attestationObject, clientDataJSON, deviceName? }
 */
router.post(
  '/register/verify',
  auth,
  asyncHandler(async (req, res) => {
    const { userId } = req.user!
    const { credentialId, attestationObject, clientDataJSON, deviceName } = req.body

    if (!credentialId || !attestationObject || !clientDataJSON) {
      sendError(res, 'Missing required fields: credentialId, attestationObject, clientDataJSON', 'VALIDATION_ERROR', 400)
      return
    }

    const result = await webauthnService.verifyRegistration(
      userId,
      credentialId,
      attestationObject,
      clientDataJSON,
      deviceName
    )

    sendSuccess(res, result, 201)
  })
)

// ---------------------------------------------------------------------------
// Authentication — no auth required (this IS the login)
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/biometric/authenticate/options
 * Generate an authentication challenge.
 * Body: { phone }
 */
router.post(
  '/authenticate/options',
  asyncHandler(async (req, res) => {
    const { phone } = req.body

    if (!phone) {
      sendError(res, 'Phone number is required', 'VALIDATION_ERROR', 400)
      return
    }

    const options = await webauthnService.generateAuthenticationOptions(phone)

    if (!options) {
      // Don't reveal whether user exists — return generic error
      sendError(res, 'Biometric login not available', 'BIOMETRIC_NOT_AVAILABLE', 400)
      return
    }

    sendSuccess(res, { options })
  })
)

/**
 * POST /api/auth/biometric/authenticate/verify
 * Verify assertion and return JWT tokens (same as password/OTP login).
 * Body: { credentialId, authenticatorData, clientDataJSON, signature, phone }
 */
router.post(
  '/authenticate/verify',
  asyncHandler(async (req, res) => {
    const { credentialId, authenticatorData, clientDataJSON, signature, phone } = req.body

    if (!credentialId || !authenticatorData || !clientDataJSON || !signature || !phone) {
      sendError(res, 'Missing required fields', 'VALIDATION_ERROR', 400)
      return
    }

    try {
      const { userId, phone: userPhone } = await webauthnService.verifyAuthentication(
        credentialId,
        authenticatorData,
        clientDataJSON,
        signature,
        phone
      )

      // Find active business for token
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { lastActiveBusinessId: true },
      })

      const businessId = user?.lastActiveBusinessId ?? ''
      const tokens = generateTokens(userId, userPhone, businessId)

      // Store refresh token
      await prisma.refreshToken.create({
        data: {
          userId,
          token: tokens.refreshToken,
          deviceInfo: 'biometric',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      // Set httpOnly cookies
      authService.setTokenCookies(res, tokens)

      // Get full user data (same shape as /me)
      const meData = await authService.getMe(userId, businessId)

      res.set('Cache-Control', 'no-store')
      sendSuccess(res, {
        user: meData?.user ?? { id: userId, phone: userPhone },
        businesses: meData?.businesses ?? [],
        activeBusiness: meData?.activeBusiness ?? null,
      })
    } catch (err) {
      logger.warn('biometric.auth_failed', {
        phone,
        error: (err as Error).message,
      })
      sendError(res, 'Biometric authentication failed', 'BIOMETRIC_FAILED', 401)
    }
  })
)

// ---------------------------------------------------------------------------
// Credential management — requires authenticated user
// ---------------------------------------------------------------------------

/**
 * GET /api/auth/biometric/credentials
 * List user's registered biometric credentials.
 */
router.get(
  '/credentials',
  auth,
  asyncHandler(async (req, res) => {
    const credentials = await webauthnService.listCredentials(req.user!.userId)
    sendSuccess(res, credentials)
  })
)

/**
 * DELETE /api/auth/biometric/credentials/:id
 * Remove a specific credential.
 */
router.delete(
  '/credentials/:id',
  auth,
  asyncHandler(async (req, res) => {
    await webauthnService.deleteCredential(req.user!.userId, String(req.params.id))
    sendSuccess(res, { message: 'Credential removed' })
  })
)

export default router
