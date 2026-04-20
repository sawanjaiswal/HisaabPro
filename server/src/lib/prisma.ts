/**
 * Prisma singleton — HisaabPro
 * Connection pooling (10) + soft-delete extension + slow query logging
 */

import { PrismaClient } from '@prisma/client'
import logger from './logger.js'
import { createSoftDeleteExtension } from './soft-delete/index.js'

const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof createPrismaClient> }

function getDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) {
    throw new Error('FATAL: DATABASE_URL environment variable is required')
  }
  if (baseUrl.includes('connection_limit')) return baseUrl
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}connection_limit=10&pool_timeout=30`
}

import { SLOW_QUERY_THRESHOLD_MS as DEFAULT_SLOW_THRESHOLD } from '../config/security.js'

const SLOW_QUERY_THRESHOLD_MS = Number(process.env.SLOW_QUERY_MS) || DEFAULT_SLOW_THRESHOLD

function createPrismaClient() {
  const logConfig = process.env.NODE_ENV === 'development'
    ? [{ level: 'query' as const, emit: 'event' as const }, 'warn' as const, 'error' as const]
    : [{ level: 'query' as const, emit: 'event' as const }, 'error' as const]

  const base = new PrismaClient({
    log: logConfig,
    datasources: {
      db: { url: getDatabaseUrl() },
    },
    // Global transaction defaults — prevents runaway interactive transactions
    // (prior default of 5s was too short for bulk imports and FY closure;
    // 20s covers the heaviest writes while still failing fast on deadlocks).
    transactionOptions: {
      timeout: 20_000,
      maxWait: 5_000,
    },
  })

  // Log slow queries (configurable via SLOW_QUERY_MS env, default 500ms)
  base.$on('query', (e) => {
    if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn('Slow query detected', {
        duration: `${e.duration}ms`,
        query: e.query.slice(0, 200),
        params: e.params?.slice(0, 100),
      })
    }
  })

  // Apply soft-delete extension (auto-filter + delete interception)
  return base.$extends(createSoftDeleteExtension())
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

/** Type of the extended prisma client — use this instead of PrismaClient in service signatures */
export type ExtendedPrismaClient = typeof prisma

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

logger.info('Database connection initialized (soft-delete extension active)')
