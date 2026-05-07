/**
 * POS Checkout — Idempotency Guard
 *
 * Uses the existing IdempotencyLog table (key, userId, response, expiresAt).
 * For POS we scope the key as "pos:{businessId}:{idempotencyKey}" so it
 * never collides with other features that share the same table.
 *
 * MUST be called within the outer Prisma $transaction.
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import type { PosSaleDTO } from './pos.types.js'
import { IDEMPOTENCY_TTL_MS } from './pos.constants.js'
import logger from '../../lib/logger.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

/** Namespace prefix to isolate POS keys from other IdempotencyLog users. */
const POS_KEY_PREFIX = 'pos:'

function scopedKey(businessId: string, key: string): string {
  return `${POS_KEY_PREFIX}${businessId}:${key}`
}

export interface IdempotencyHit {
  hit: true
  response: PosSaleDTO
}
export interface IdempotencyMiss {
  hit: false
}
export type IdempotencyCheckResult = IdempotencyHit | IdempotencyMiss

/**
 * Check whether the given key was already processed within the TTL window.
 *
 * - Hit → return the stored response (no re-processing).
 * - Miss → return { hit: false }; caller must call `storeIdempotency` after success.
 *
 * @param tx         - Prisma transaction client
 * @param businessId - Owning business (scopes the key)
 * @param key        - UUID v4 from the client's X-Idempotency-Key / body field
 * @param ttlMs      - How long the key is considered valid (default: IDEMPOTENCY_TTL_MS)
 */
export async function checkIdempotency(
  tx: TxClient,
  businessId: string,
  key: string,
  ttlMs: number = IDEMPOTENCY_TTL_MS  // used by storeIdempotency; kept here for API symmetry
): Promise<IdempotencyCheckResult> {
  void ttlMs  // intentionally unused in check path — only used in store path
  const full = scopedKey(businessId, key)
  const now = new Date()

  const existing = await tx.idempotencyLog.findUnique({
    where: { key: full },
    select: { response: true, expiresAt: true },
  })

  if (existing && existing.expiresAt > now) {
    logger.info('POS idempotency hit — returning cached response', { businessId, key })
    return { hit: true, response: existing.response as unknown as PosSaleDTO }
  }

  // Stale record present (expired TTL) — will be overwritten by storeIdempotency
  return { hit: false }
}

/**
 * Persist the completed sale DTO so that a duplicate request within the TTL
 * window returns the same response instead of creating a second sale.
 *
 * Upserts to handle the rare case where an expired record already exists.
 *
 * @param tx         - Prisma transaction client
 * @param businessId - Owning business
 * @param key        - UUID v4 from the client
 * @param response   - Completed PosSaleDTO to store as JSON
 * @param userId     - User who initiated the sale (required by IdempotencyLog schema)
 * @param ttlMs      - TTL in ms (default: IDEMPOTENCY_TTL_MS)
 */
export async function storeIdempotency(
  tx: TxClient,
  businessId: string,
  key: string,
  response: PosSaleDTO,
  userId: string,
  ttlMs: number = IDEMPOTENCY_TTL_MS
): Promise<void> {
  const full = scopedKey(businessId, key)
  const expiresAt = new Date(Date.now() + ttlMs)

  await tx.idempotencyLog.upsert({
    where: { key: full },
    create: {
      key: full,
      userId,
      response: response as unknown as Record<string, unknown>,
      expiresAt,
    },
    update: {
      userId,
      response: response as unknown as Record<string, unknown>,
      expiresAt,
    },
  })

  logger.debug('POS idempotency stored', { businessId, key })
}
