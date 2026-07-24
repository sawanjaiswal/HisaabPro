/**
 * hardDeleteCashEntry — owner-only, voided entries only.
 * Writes HARD_DELETED snapshot to platform AuditLog BEFORE deleting row (same tx).
 * Cascade kills CashEntryEvent rows.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, conflictError } from '../../lib/errors.js'
import { createAuditEntry } from '../settings/audit.js'

export async function hardDeleteCashEntry(args: {
  businessId: string
  userId: string
  id: string
}): Promise<void> {
  const { businessId, userId, id } = args

  const entry = await prisma.cashEntry.findFirst({
    where: { id, businessId },
    include: { events: { orderBy: { createdAt: 'asc' } } },
  })
  if (!entry) throw notFoundError('CashEntry')
  if (!entry.voidedAt) throw conflictError('Only voided entries can be hard deleted')

  await prisma.$transaction(
    async (tx) => {
      // Write platform audit log BEFORE the delete (cascade would erase events)
      await createAuditEntry({
        businessId,
        action: 'HARD_DELETED',
        entityType: 'cashEntry',
        entityId: id,
        entityLabel: `${entry.direction} ${Number(entry.amountPaise)} (${entry.expression})`,
        userId: userId, // AuditLog.userId is FK to User.id (not BusinessUser.id)
        changes: {
          snapshot: {
            id: entry.id,
            businessId: entry.businessId,
            expression: entry.expression,
            amountPaise: Number(entry.amountPaise),
            direction: entry.direction,
            note: entry.note,
            createdBy: entry.createdBy,
            createdAt: entry.createdAt.toISOString(),
            voidedAt: entry.voidedAt?.toISOString() ?? null,
            voidReason: entry.voidReason,
          },
          events: entry.events.map((e) => ({
            id: e.id,
            eventType: e.eventType,
            actorId: e.actorId,
            reason: e.reason,
            changes: e.changes,
            createdAt: e.createdAt.toISOString(),
          })),
        },
      }, tx)

      // Hard delete — voidedAt guard at DB level
      const deleted = await tx.cashEntry.deleteMany({
        where: { id, businessId, voidedAt: { not: null } },
      })
      if (deleted.count === 0) throw conflictError('Entry could not be deleted: not voided')
    },
    { isolationLevel: 'Serializable' },
  )
}
