/**
 * Idempotency middleware — adapted from HisaabPro
 * Prevents duplicate creates from offline sync retries (2G/3G networks).
 * Client sends X-Idempotency-Key header; server deduplicates.
 *
 * Requires IdempotencyLog model in Prisma schema.
 */

import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'

const DEFAULT_TTL_DAYS = 5

export function idempotencyCheck() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined
    if (!idempotencyKey) return next()

    const userId = req.user?.userId
    if (!userId) return next()

    try {
      const existing = await prisma.idempotencyLog.findUnique({
        where: { key: idempotencyKey },
      })

      if (existing) {
        if (existing.userId !== userId) {
          logger.warn('IDEMPOTENCY_KEY_USER_MISMATCH', { key: idempotencyKey })
          return next()
        }
        if (existing.expiresAt < new Date()) {
          await prisma.idempotencyLog.delete({ where: { key: idempotencyKey } })
          return next()
        }
        logger.info('IDEMPOTENCY_HIT', { key: idempotencyKey, userId })
        return res.status(200).json(existing.response)
      }

      // Intercept response to store it
      const originalJson = res.json.bind(res)
      res.json = function (body: unknown) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const expiresAt = new Date(Date.now() + DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000)
          prisma.idempotencyLog.create({
            data: { key: idempotencyKey, userId, response: body as object, expiresAt },
          }).catch((err: { code?: string }) => {
            if (err.code !== 'P2002') {
              logger.error('IDEMPOTENCY_STORE_ERROR', { key: idempotencyKey })
            }
          })
        }
        return originalJson(body)
      }

      next()
    } catch {
      logger.error('IDEMPOTENCY_CHECK_ERROR', { key: idempotencyKey })
      next()
    }
  }
}

/** Cleanup expired keys — call from a daily cron job */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  const result = await prisma.idempotencyLog.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  logger.info('IDEMPOTENCY_CLEANUP', { deleted: result.count })
  return result.count
}
