/**
 * Prisma singleton — adapted from HisaabPro
 * Connection pooling (10) + slow query logging
 */

import { PrismaClient } from '@prisma/client'
import logger from './logger.js'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function getDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL || ''
  if (baseUrl.includes('connection_limit')) return baseUrl
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}connection_limit=10&pool_timeout=30`
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'warn', 'error']
    : ['error'],
  datasources: {
    db: { url: getDatabaseUrl() },
  },
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

logger.info('Database connection initialized')
