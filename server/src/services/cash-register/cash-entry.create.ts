/**
 * createCashEntry — opens its own transaction, emits CREATED event.
 * Idempotent: pre-tx lookup on (businessId, idempotencyKey) returns existing row.
 */

import { prisma } from '../../lib/prisma.js'
import { evaluateExpression } from '../../lib/expression-evaluator.js'
import { notFoundError } from '../../lib/errors.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import type { CashEntry, Prisma } from '@prisma/client'

export type CashEntryDTO = {
  id: string
  businessId: string
  expression: string
  amountPaise: number
  direction: 'IN' | 'OUT'
  note: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  voidedAt: string | null
  voidedBy: string | null
  voidReason: string | null
  idempotencyKey: string | null
}

export function toCashEntryDTO(row: CashEntry): CashEntryDTO {
  return {
    id: row.id,
    businessId: row.businessId,
    expression: row.expression,
    amountPaise: Number(row.amountPaise),
    direction: row.direction as 'IN' | 'OUT',
    note: row.note ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidedBy: row.voidedBy ?? null,
    voidReason: row.voidReason ?? null,
    idempotencyKey: row.idempotencyKey ?? null,
  }
}

export async function resolveBusinessUser(
  userId: string,
  businessId: string,
): Promise<{ id: string; actorName: string }> {
  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId } },
    select: { id: true, user: { select: { name: true } } },
  })
  if (!bu) throw notFoundError('BusinessUser')
  return { id: bu.id, actorName: bu.user?.name ?? 'Unknown' }
}

export async function createCashEntry(args: {
  businessId: string
  userId: string
  direction: 'IN' | 'OUT'
  expression: string
  note: string | null
  idempotencyKey: string | null
}): Promise<CashEntryDTO> {
  const { businessId, userId, direction, expression, note, idempotencyKey } = args

  // Evaluate expression server-side — never trust client amount
  let amountPaise: number
  try {
    amountPaise = evaluateExpression(expression)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'INVALID_EXPRESSION'
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, msg)
  }

  // Idempotency fast-path — pre-tx lookup
  if (idempotencyKey) {
    const existing = await prisma.cashEntry.findUnique({
      where: { businessId_idempotencyKey: { businessId, idempotencyKey } },
    })
    if (existing) return toCashEntryDTO(existing)
  }

  const bu = await resolveBusinessUser(userId, businessId)

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.cashEntry.create({
        data: {
          businessId,
          createdBy: bu.id,
          direction,
          amountPaise,
          expression,
          note: note ?? null,
          idempotencyKey: idempotencyKey ?? null,
        },
      })
      await tx.cashEntryEvent.create({
        data: {
          cashEntryId: created.id,
          eventType: 'CREATED',
          actorId: bu.id,
          changes: { direction, amountPaise, expression, note } as Prisma.InputJsonValue,
        },
      })
      return created
    })
    return toCashEntryDTO(entry)
  } catch (err: unknown) {
    const pErr = err as { code?: string }
    if (pErr?.code === 'P2002' && idempotencyKey) {
      const existing = await prisma.cashEntry.findUnique({
        where: { businessId_idempotencyKey: { businessId, idempotencyKey } },
      })
      if (existing) return toCashEntryDTO(existing)
    }
    throw err
  }
}
