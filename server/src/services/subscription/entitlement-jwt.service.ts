/**
 * Entitlement JWT Service — RS256 sign/verify for offline subscription gating.
 *
 * TTL: 24 hours (Sawan decision: 24h is the locked value per mission-active.md).
 * SECURITY P1-G: JWT string MUST NEVER appear in logger calls.
 * SECURITY P2-C: uid claim omitted (bid is sufficient for gating).
 * SECURITY: trustedTime claim enables FE clock-rewind detection.
 */

import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { getPrivateKey } from './entitlement-jwt.keys.js'
import { PLAN_LIMITS } from '../../config/plans.js'
import logger from '../../lib/logger.js'
import type { EntitlementClaims, SubscriptionPlanTier, SubscriptionState } from './subscription.types.js'

// ─── Constants ────────────────────────────────────────────────────────────────

/** 24 hours in seconds — locked value (Sawan decision). */
export const TTL_SECONDS = 86_400

// ─── Input ────────────────────────────────────────────────────────────────────

export interface EntitlementInput {
  subscriptionId: string
  businessId: string
  tier: SubscriptionPlanTier
  state: SubscriptionState
  graceUntil: Date | null
  addonCodes: string[]
}

// ─── Sign ─────────────────────────────────────────────────────────────────────

/**
 * Sign an entitlement JWT (RS256, 24h TTL).
 * Returns null when ENTITLEMENT_PRIVATE_KEY is not configured (graceful degradation).
 * SECURITY: Return value is a signed JWT — NEVER log it.
 */
export function signEntitlementToken(input: EntitlementInput): string | null {
  const privateKey = getPrivateKey()
  if (!privateKey) return null

  const baseLimits = PLAN_LIMITS[input.tier as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.FREE
  const features: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(baseLimits)) {
    if (typeof value === 'boolean') {
      features[key] = value
    }
  }
  // Overlay addon features
  for (const code of input.addonCodes) {
    features[code] = true
  }

  const now = new Date()

  const claims: Omit<EntitlementClaims, 'iat' | 'exp'> = {
    iss: 'hisaabpro-api',
    aud: 'hisaabpro-client',
    sub: input.subscriptionId,
    bid: input.businessId,
    tier: input.tier,
    state: input.state,
    graceUntil: input.graceUntil ? input.graceUntil.toISOString() : null,
    features,
    addons: input.addonCodes,
    trustedTime: now.toISOString(),
    jti: randomUUID(),
  }

  try {
    const token = jwt.sign(claims, privateKey, {
      algorithm: 'RS256',
      expiresIn: TTL_SECONDS,
      issuer: 'hisaabpro-api',
      audience: 'hisaabpro-client',
    } as jwt.SignOptions)

    logger.info('entitlement_jwt.issued', {
      businessId: input.businessId,
      tier: input.tier,
      state: input.state,
      ttlSeconds: TTL_SECONDS,
      // NEVER log token itself (P1-G)
    })

    return token
  } catch (err) {
    logger.error('entitlement_jwt.sign_error', {
      businessId: input.businessId,
      error: err instanceof Error ? err.message : 'unknown',
    })
    return null
  }
}

/**
 * Verify an entitlement JWT using the public key.
 * Returns decoded claims or null on any failure.
 * Used server-side for validation; FE uses WebCrypto instead.
 */
export function verifyEntitlementToken(
  token: string,
  publicKeyPem: string,
): EntitlementClaims | null {
  try {
    const decoded = jwt.verify(token, publicKeyPem, {
      algorithms: ['RS256'],
      issuer: 'hisaabpro-api',
      audience: 'hisaabpro-client',
    }) as EntitlementClaims

    return decoded
  } catch (err) {
    logger.warn('entitlement_jwt.verify_failed', {
      error: err instanceof Error ? err.name : 'unknown',
      // NEVER log the token (P1-G)
    })
    return null
  }
}
