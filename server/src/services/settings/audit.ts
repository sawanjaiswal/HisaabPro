/**
 * Audit Log — list and create audit entries
 */

import { prisma } from '../../lib/prisma.js'
import type { AuditLogQuery } from '../../schemas/settings.schemas.js'

export async function listAuditLog(businessId: string, query: AuditLogQuery) {
  const { userId, entityType, action, from, to, page, limit } = query

  const where: Record<string, unknown> = { businessId }
  if (userId) where.userId = userId
  if (entityType) where.entityType = entityType
  if (action) where.action = action
  if (from || to) {
    where.createdAt = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to) }),
    }
  }

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true, action: true, entityType: true, entityId: true,
        entityLabel: true, changes: true, reason: true,
        ipAddress: true, deviceInfo: true, createdAt: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    entries,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

/** Create an audit log entry — called from other services */
export async function createAuditEntry(data: {
  businessId: string
  action: string
  entityType: string
  entityId: string
  entityLabel?: string
  userId: string
  changes?: unknown
  reason?: string
  ipAddress?: string
  deviceInfo?: string
}) {
  return prisma.auditLog.create({
    data: {
      businessId: data.businessId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      entityLabel: data.entityLabel || null,
      userId: data.userId,
      changes: data.changes as object || null,
      reason: data.reason || null,
      ipAddress: data.ipAddress || null,
      deviceInfo: data.deviceInfo || null,
    },
  })
}
