/**
 * Expense Confirm/Skip Service — lifecycle transitions for PENDING_CONFIRMATION rows.
 * confirmExpense: idempotent 409 on double-confirm.
 * skipExpense: soft-deletes the row; advances template dates if template-derived.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, conflictError, AppError, ErrorCode } from '../../lib/errors.js'
import { computeNextRunDate } from './recurring.dates.js'
import type { ExpenseFrequency } from './recurring.dates.js'
import { postExpense } from '../accounting/posting/index.js'

// ── Public API ─────────────────────────────────────────────────────────────

export interface ConfirmResult {
  id: string
  status: 'CONFIRMED'
  confirmedAt: Date
}

export interface SkipResult {
  id: string
  status: 'SKIPPED'
  skippedAt: Date
}

export async function confirmExpense(
  businessId: string,
  expenseId: string,
  userId: string,
): Promise<ConfirmResult> {
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findFirst({
      where: { id: expenseId, businessId, isDeleted: false },
      select: {
        id: true, status: true, categoryId: true, amount: true,
        gstAmount: true, paymentMode: true, date: true,
        category: { select: { name: true } },
      },
    })

    if (!expense) throw notFoundError('Expense')

    if (expense.status === 'CONFIRMED') {
      throw new AppError(
        ErrorCode.DUPLICATE_ENTRY,
        409,
        'Expense already confirmed',
        { code: 'ALREADY_CONFIRMED' },
      )
    }

    if (expense.status === 'SKIPPED') {
      throw conflictError('Cannot confirm a skipped expense')
    }

    if (expense.status === 'VOIDED') {
      throw conflictError('Cannot confirm a voided expense')
    }

    await tx.expense.update({
      where: { id: expense.id },
      data: { status: 'CONFIRMED', confirmedAt: now },
    })

    // S1 — GL auto-posting: Dr Expense + ITC, Cr Cash/Bank. Hard-atomic.
    await postExpense(tx, {
      businessId,
      userId,
      expense: {
        id: expense.id,
        amount: expense.amount,
        gstAmount: expense.gstAmount,
        paymentMode: expense.paymentMode,
        categoryName: expense.category.name,
        date: expense.date,
      },
    })

    // Audit log (fire-and-forget inside tx — on tx rollback the audit row also rolls back)
    await tx.auditLog.create({
      data: {
        businessId,
        action: 'UPDATE',
        entityType: 'expense',
        entityId: expense.id,
        entityLabel: `Expense confirmed`,
        userId,
        changes: { status: { from: expense.status, to: 'CONFIRMED' } },
      },
    })

    return { id: expense.id, status: 'CONFIRMED' as const, confirmedAt: now }
  })
}

export async function skipExpense(
  businessId: string,
  expenseId: string,
  userId: string,
): Promise<SkipResult> {
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findFirst({
      where: { id: expenseId, businessId, isDeleted: false },
      select: { id: true, status: true, templateId: true },
    })

    if (!expense) throw notFoundError('Expense')

    if (expense.status === 'CONFIRMED') {
      throw new AppError(
        ErrorCode.DUPLICATE_ENTRY,
        409,
        'Cannot skip an already confirmed expense',
        { code: 'ALREADY_CONFIRMED' },
      )
    }

    if (expense.status === 'SKIPPED') {
      throw conflictError('Expense already skipped')
    }

    // Soft-delete and mark skipped
    await tx.expense.update({
      where: { id: expense.id },
      data: {
        status: 'SKIPPED',
        skippedAt: now,
        isDeleted: true,
        deletedAt: now,
      },
    })

    // Advance template dates if this is a template-derived expense.
    // Per architecture: nextRunDate is already advanced by the worker at creation;
    // we also update lastRunDate here to keep the template in sync.
    if (expense.templateId) {
      const template = await tx.expenseTemplate.findFirst({
        where: { id: expense.templateId, businessId, isDeleted: false },
        select: {
          id: true,
          frequency: true,
          nextRunDate: true,
          dayOfMonth: true,
          dayOfWeek: true,
        },
      })

      if (template) {
        const nextRun = computeNextRunDate(
          template.frequency as ExpenseFrequency,
          template.nextRunDate,
          template.dayOfMonth,
          template.dayOfWeek,
        )

        await tx.expenseTemplate.update({
          where: { id: template.id },
          data: {
            nextRunDate: nextRun,
            lastRunDate: template.nextRunDate,
          },
        })
      }
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        businessId,
        action: 'UPDATE',
        entityType: 'expense',
        entityId: expense.id,
        entityLabel: 'Expense skipped',
        userId,
        changes: { status: { from: expense.status, to: 'SKIPPED' } },
      },
    })

    return { id: expense.id, status: 'SKIPPED' as const, skippedAt: now }
  })
}
