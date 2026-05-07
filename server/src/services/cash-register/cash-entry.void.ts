/**
 * voidCashEntry — idempotent (voiding already-voided = CONFLICT).
 * Serializable isolation prevents multi-tab race.
 * Emits VOIDED event with reason.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, conflictError } from '../../lib/errors.js'
import { toCashEntryDTO, resolveBusinessUser } from './cash-entry.create.js'
import type { CashEntryDTO } from './cash-entry.create.js'
import type { Prisma } from '@prisma/client'

export async function voidCashEntry(args: {
  businessId: string
  userId: string
  id: string
  reason: string | null
}): Promise<CashEntryDTO> {
  const { businessId, userId, id, reason } = args

  const entry = await prisma.cashEntry.findFirst({ where: { id, businessId } })
  if (!entry) throw notFoundError('CashEntry')
  if (entry.voidedAt) throw conflictError('Entry is already voided')

  const bu = await resolveBusinessUser(userId, businessId)

  const updated = await prisma.$transaction(
    async (tx) => {
      const result = await tx.cashEntry.update({
        where: { id },
        data: {
          voidedAt: new Date(),
          voidedBy: bu.id,
          voidReason: reason ?? null,
        },
      })
      await tx.cashEntryEvent.create({
        data: {
          cashEntryId: id,
          eventType: 'VOIDED',
          actorId: bu.id,
          reason: reason ?? null,
          changes: { reason } as Prisma.InputJsonValue,
        },
      })
      return result
    },
    { isolationLevel: 'Serializable' },
  )

  return toCashEntryDTO(updated)
}
