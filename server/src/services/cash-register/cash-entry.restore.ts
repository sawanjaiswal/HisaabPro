/**
 * restoreCashEntry — idempotent (restoring active entry = CONFLICT).
 * Serializable isolation. Emits RESTORED event.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, conflictError } from '../../lib/errors.js'
import { toCashEntryDTO, resolveBusinessUser } from './cash-entry.create.js'
import type { CashEntryDTO } from './cash-entry.create.js'
import type { Prisma } from '@prisma/client'

export async function restoreCashEntry(args: {
  businessId: string
  userId: string
  id: string
}): Promise<CashEntryDTO> {
  const { businessId, userId, id } = args

  const entry = await prisma.cashEntry.findFirst({ where: { id, businessId } })
  if (!entry) throw notFoundError('CashEntry')
  if (!entry.voidedAt) throw conflictError('Entry is not voided, cannot restore')

  const bu = await resolveBusinessUser(userId, businessId)
  const priorReason = entry.voidReason

  const updated = await prisma.$transaction(
    async (tx) => {
      const result = await tx.cashEntry.update({
        where: { id },
        data: {
          voidedAt: null,
          voidedBy: null,
          voidReason: null,
        },
      })
      await tx.cashEntryEvent.create({
        data: {
          cashEntryId: id,
          eventType: 'RESTORED',
          actorId: bu.id,
          changes: { priorReason } as Prisma.InputJsonValue,
        },
      })
      return result
    },
    { isolationLevel: 'Serializable' },
  )

  return toCashEntryDTO(updated)
}
