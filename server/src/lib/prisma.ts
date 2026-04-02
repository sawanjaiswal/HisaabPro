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

function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'warn', 'error']
      : ['error'],
    datasources: {
      db: { url: getDatabaseUrl() },
    },
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
