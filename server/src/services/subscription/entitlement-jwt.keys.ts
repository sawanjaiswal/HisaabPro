/**
 * Entitlement JWT Key Loader — loads + caches RSA PEM keys from env.
 *
 * SECURITY: Private key MUST NEVER appear in any logger call.
 * SECURITY P2-C: Keys are optional — if unset, returns null for graceful degradation.
 *
 * Key rotation: ENTITLEMENT_PRIVATE_KEY (current) + ENTITLEMENT_KEY_PREV (optional).
 * After 24h of new key in place, drop ENTITLEMENT_KEY_PREV.
 */

import logger from '../../lib/logger.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EntitlementKeys {
  privateKey: string     // PEM — current signing key
  publicKey: string      // PEM — current verify key
  publicKeyPrev?: string // PEM — previous verify key (rotation window)
}

// ─── In-process cache ─────────────────────────────────────────────────────────

let cachedKeys: EntitlementKeys | null = null

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a redacted hint string safe for logging (NOT the key itself). */
export function redactKeyForLog(pem: string): string {
  const firstLine = pem.split('\n')[0] ?? ''
  return `${firstLine.slice(0, 20)}...[redacted]`
}

// ─── Load ─────────────────────────────────────────────────────────────────────

/**
 * Load entitlement JWT keys from environment.
 * Returns null if ENTITLEMENT_PRIVATE_KEY is not set — FE degrades to online-only.
 */
export function loadEntitlementKeys(): EntitlementKeys | null {
  if (cachedKeys) return cachedKeys

  const privateKey = process.env.ENTITLEMENT_PRIVATE_KEY
  const publicKey = process.env.ENTITLEMENT_PUBLIC_KEY
  const publicKeyPrev = process.env.ENTITLEMENT_KEY_PREV

  if (!privateKey || !publicKey) {
    logger.warn('entitlement_jwt.keys_not_configured', {
      message: 'ENTITLEMENT_PRIVATE_KEY or ENTITLEMENT_PUBLIC_KEY not set — offlineToken will be null',
    })
    return null
  }

  // Validate PEM headers without logging key content
  if (!privateKey.includes('BEGIN') || !publicKey.includes('BEGIN')) {
    logger.error('entitlement_jwt.invalid_key_format', {
      privateKeyHint: redactKeyForLog(privateKey),
      message: 'Keys must be PEM-encoded RSA keys',
    })
    return null
  }

  cachedKeys = {
    privateKey,
    publicKey,
    publicKeyPrev: publicKeyPrev ?? undefined,
  }

  logger.info('entitlement_jwt.keys_loaded', {
    publicKeyHint: redactKeyForLog(publicKey),
    hasPrevKey: Boolean(publicKeyPrev),
  })

  return cachedKeys
}

/** Reset cache — for testing only. */
export function _resetKeyCache(): void {
  cachedKeys = null
}

/** Get current private key (signing). Returns null if not configured. */
export function getPrivateKey(): string | null {
  return loadEntitlementKeys()?.privateKey ?? null
}

/** Get current public key (verification). Returns null if not configured. */
export function getPublicKey(): string | null {
  return loadEntitlementKeys()?.publicKey ?? null
}

/** Get previous public key for rotation window. Returns null if not set. */
export function getPrevPublicKey(): string | null {
  return loadEntitlementKeys()?.publicKeyPrev ?? null
}
