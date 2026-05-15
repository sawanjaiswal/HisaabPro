/**
 * Entitlement Public Key Route — serve RS256 public key to FE at boot.
 *
 * GET /api/auth/entitlement-pubkey — public-readable, no auth required.
 * FE caches this in IDB, imports via WebCrypto.importKey() once.
 *
 * SECURITY: ONLY returns ENTITLEMENT_PUBLIC_KEY — never the private key.
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { getPublicKey } from '../../services/subscription/entitlement-jwt.keys.js'

export const entitlementPubkeyRouter = Router()

entitlementPubkeyRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const publicKey = getPublicKey()

    if (!publicKey) {
      sendError(res, 'Entitlement JWT not configured — offline token unavailable', 'NOT_CONFIGURED', 503)
      return
    }

    sendSuccess(res, {
      publicKey,
      algorithm: 'RS256',
      ttlSeconds: 86400,
    })
  }),
)
