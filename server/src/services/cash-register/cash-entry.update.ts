/**
 * editCashEntry — PATCH expression/note. Cannot edit voided entries.
 * Emits EDITED event with before/after diff.
 */

import { prisma } from '../../lib/prisma.js'
import { evaluateExpression } from '../../lib/expression-evaluator.js'
import { notFoundError, conflictError } from '../../lib/errors.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import { toCashEntryDTO, resolveBusinessUser } from './cash-entry.create.js'
import type { CashEntryDTO } from './cash-entry.create.js'
import type { Prisma } from '@prisma/client'

export async function editCashEntry(args: {
  businessId: string
  userId: string
  id: string
  patch: { expression?: string; note?: string | null }
}): Promise<CashEntryDTO> {
  const { businessId, userId, id, patch } = args

  const entry = await prisma.cashEntry.findFirst({ where: { id, businessId } })
  if (!entry) throw notFoundError('CashEntry')
  if (entry.voidedAt) throw conflictError('Cannot edit a voided entry')

  const bu = await resolveBusinessUser(userId, businessId)

  let newAmountPaise: number = Number(entry.amountPaise)
  let newExpression: string = entry.expression

  if (patch.expression !== undefined) {
    try {
      newAmountPaise = evaluateExpression(patch.expression)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'INVALID_EXPRESSION'
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, msg)
    }
    newExpression = patch.expression
  }

  const before = {
    expression: entry.expression,
    amountPaise: Number(entry.amountPaise),
    note: entry.note ?? null,
  }
  const after = {
    expression: newExpression,
    amountPaise: newAmountPaise,
    note: patch.note !== undefined ? (patch.note ?? null) : (entry.note ?? null),
  }
  const changedFields = Object.keys(after).filter(
    (k) => after[k as keyof typeof after] !== before[k as keyof typeof before],
  )

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.cashEntry.update({
      where: { id },
      data: {
        expression: newExpression,
        amountPaise: newAmountPaise,
        note: patch.note !== undefined ? (patch.note ?? null) : entry.note,
      },
    })
    await tx.cashEntryEvent.create({
      data: {
        cashEntryId: id,
        eventType: 'EDITED',
        actorId: bu.id,
        changes: { before, after, changedFields } as Prisma.InputJsonValue,
      },
    })
    return result
  })

  return toCashEntryDTO(updated)
}
