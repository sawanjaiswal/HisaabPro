/**
 * Production Run Idempotency Guard
 *
 * Mirrors pos-checkout.idempotency.ts with prefix `prod:{businessId}:`.
 * Scoped key prevents cross-business collision.
 * TTL: 72 hours.
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import type { ProductionRunDetailDTO } from './production-run.types.js'
import logger from '../../lib/logger.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

const PROD_KEY_PREFIX = 'prod:'
const TTL_MS = 72 * 60 * 60 * 1000 // 72 hours

function scopedKey(businessId: string, key: string): string {
  return `${PROD_KEY_PREFIX}${businessId}:${key}`
}

export interface ProdIdempotencyHit {
  hit: true
  response: ProductionRunDetailDTO
}
export interface ProdIdempotencyMiss {
  hit: false
}
export type ProdIdempotencyResult = ProdIdempotencyHit | ProdIdempotencyMiss

/**
 * Check for an existing idempotency record (OUTSIDE the transaction — fast pre-check).
 */
export async function checkProductionRunReplay(
  prismaClient: ExtendedPrismaClient,
  businessId: string,
  key: string
): Promise<ProdIdempotencyResult> {
  const full = scopedKey(businessId, key)
  const now = new Date()
  const existing = await prismaClient.idempotencyLog.findUnique({
    where: { key: full },
    select: { response: true, expiresAt: true },
  })
  if (existing && existing.expiresAt > now) {
    logger.info('Production run idempotency hit', { businessId, key })
    return { hit: true, response: existing.response as unknown as ProductionRunDetailDTO }
  }
  return { hit: false }
}

/**
 * Persist the completed production run DTO INSIDE the transaction so the
 * lookup-then-insert pair is atomic with the run write.
 */
export async function storeProductionRunIdempotency(
  tx: TxClient,
  businessId: string,
  key: string,
  response: ProductionRunDetailDTO,
  userId: string
): Promise<void> {
  const full = scopedKey(businessId, key)
  const expiresAt = new Date(Date.now() + TTL_MS)

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

  logger.debug('Production run idempotency stored', { businessId, key })
}
