/**
 * Audit Log — list and create audit entries
 */

import type { Prisma } from '@prisma/client'
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

// Minimal structural handle so the writer accepts BOTH the global client and
// an interactive-transaction `tx` (callers that must write the audit row inside
// their own $transaction get atomic rollback).
type AuditWriteClient = {
  auditLog: {
    create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>
  }
}

/**
 * Canonical AuditLog writer — the ONE correct way to record an audit entry.
 * Every service should call this instead of a bespoke `prisma.auditLog.create`.
 *
 * It owns the two invariants hand-rolled call sites keep getting wrong (see
 * .claude/fix-trace-erasure-audit-fk.md):
 *  - `businessId` is a NOT-NULL FK to Business — there is no valid literal
 *    'SYSTEM'. A system/platform action still records against a REAL business.
 *  - a system actor leaves `userId` NULL — the FK is `onDelete: Restrict`, so a
 *    stray user reference blocks that user's later deletion — and names the
 *    actor via `systemActor`. Pass one of `userId` / `systemActor`, not both.
 *
 * `client` defaults to the global prisma; pass a `tx` to write transactionally.
 */
export async function createAuditEntry(
  data: {
    businessId: string
    action: string
    entityType: string
    entityId: string
    entityLabel?: string
    userId?: string | null
    systemActor?: string
    changes?: unknown
    reason?: string
    ipAddress?: string
    deviceInfo?: string
  },
  client: AuditWriteClient = prisma
) {
  return client.auditLog.create({
    data: {
      businessId: data.businessId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      entityLabel: data.entityLabel || null,
      userId: data.userId ?? null,
      systemActor: data.systemActor ?? null,
      changes: (data.changes as object) || null,
      reason: data.reason || null,
      ipAddress: data.ipAddress || null,
      deviceInfo: data.deviceInfo || null,
    },
  })
}
