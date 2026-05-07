/**
 * Expense Recurring Generator — cron job that creates PENDING_CONFIRMATION
 * Expense rows for due ExpenseTemplate records.
 *
 * Schedule: daily 02:30 IST.
 * Registered via cron-scheduler.ts (see initCronJobs).
 *
 * Catch-up rule (locked): ONE expense per run, at `template.nextRunDate`.
 * Date is then advanced past `now` so next run is future-only.
 *
 * Exported `generateRecurringExpenses` is also callable from admin/test routes.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { computeNextRunDate } from './recurring.dates.js'
import type { ExpenseFrequency } from './recurring.dates.js'
import { notificationManager } from '../notifications/notification-manager.js'
import { formatPaise } from '../notifications/notification-template.service.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface RecurringGeneratorSummary {
  templatesProcessed: number
  expensesCreated: number
  errors: Array<{ templateId: string; error: string }>
}

// Fields we need from ExpenseTemplate — no over-select
interface TemplateRow {
  id: string
  businessId: string
  categoryId: string
  amountPaise: number
  frequency: string
  dayOfMonth: number | null
  dayOfWeek: number | null
  nextRunDate: Date
  lastRunDate: Date | null
  paymentMode: string
  partyId: string | null
  note: string | null
  createdBy: string
}

const TEMPLATE_SELECT = {
  id: true,
  businessId: true,
  categoryId: true,
  amountPaise: true,
  frequency: true,
  dayOfMonth: true,
  dayOfWeek: true,
  nextRunDate: true,
  lastRunDate: true,
  paymentMode: true,
  partyId: true,
  note: true,
  createdBy: true,
} as const

// ── Core job logic ─────────────────────────────────────────────────────────

/**
 * Main entry point — exported so tests and admin endpoints can call directly.
 *
 * @param now  Reference time (default: real now). Pass a fixed Date in tests.
 */
export async function generateRecurringExpenses(
  now: Date = new Date(),
): Promise<RecurringGeneratorSummary> {
  const summary: RecurringGeneratorSummary = {
    templatesProcessed: 0,
    expensesCreated: 0,
    errors: [],
  }

  logger.info('expense-recurring-generator.start', { now: now.toISOString() })

  // Load all due templates in one query — index: (businessId, isActive, nextRunDate)
  const templates = await prisma.expenseTemplate.findMany({
    where: {
      isActive: true,
      isDeleted: false,
      nextRunDate: { lte: now },
    },
    select: TEMPLATE_SELECT,
    orderBy: { nextRunDate: 'asc' },
  })

  logger.info('expense-recurring-generator.templates_found', { count: templates.length })

  for (const template of templates) {
    summary.templatesProcessed++

    try {
      const created = await processTemplate(template, now)
      if (created) summary.expensesCreated++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error('expense-recurring-generator.template_error', {
        templateId: template.id,
        error: msg,
      })
      summary.errors.push({ templateId: template.id, error: msg })
    }
  }

  logger.info('expense-recurring-generator.complete', summary)
  return summary
}

// ── Per-template processor ─────────────────────────────────────────────────

/**
 * Process one template: idempotency check → create expense → advance dates.
 * Wrapped in a single transaction so create + date-advance are atomic.
 *
 * @returns true if a new Expense row was created, false if skipped (idempotent).
 */
async function processTemplate(template: TemplateRow, now: Date): Promise<boolean> {
  const expenseDate = template.nextRunDate
  const frequency = template.frequency as ExpenseFrequency

  // Idempotency: skip if an expense for this template on this date already exists
  const existing = await prisma.expense.findFirst({
    where: {
      templateId: template.id,
      date: expenseDate,
      status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED', 'SKIPPED'] },
      isDeleted: false,
    },
    select: { id: true },
  })

  // Compute the next future run date regardless of whether we create an expense
  const nextRunDate = advancePastNow(frequency, expenseDate, now, template.dayOfMonth, template.dayOfWeek)

  if (existing) {
    logger.info('expense-recurring-generator.idempotent_skip', {
      templateId: template.id,
      expenseDate: expenseDate.toISOString(),
      existingExpenseId: existing.id,
    })
    // Still advance dates so next cron fires correctly
    await prisma.expenseTemplate.update({
      where: { id: template.id },
      data: { nextRunDate, lastRunDate: now },
    })
    return false
  }

  // Create expense + advance template dates atomically
  let createdExpenseId = ''
  await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        businessId: template.businessId,
        categoryId: template.categoryId,
        amount: template.amountPaise,
        date: expenseDate,
        paymentMode: template.paymentMode,
        partyId: template.partyId,
        notes: template.note ? `[Auto] ${template.note}` : '[Auto]',
        isRecurring: true,
        templateId: template.id,
        status: 'PENDING_CONFIRMATION',
        createdBy: template.createdBy,
      },
      select: { id: true },
    })
    createdExpenseId = created.id

    await tx.expenseTemplate.update({
      where: { id: template.id },
      data: { nextRunDate, lastRunDate: now },
    })
  })

  logger.info('expense-recurring-generator.expense_created', {
    templateId: template.id,
    expenseDate: expenseDate.toISOString(),
    nextRunDate: nextRunDate.toISOString(),
  })

  // Notify RECURRING_EXPENSE_PENDING (non-blocking)
  try {
    await notificationManager.notify('RECURRING_EXPENSE_PENDING', {
      businessId: template.businessId,
      userId: template.createdBy,
      eventKey: 'RECURRING_EXPENSE_PENDING',
      locale: 'en',
      vars: {
        amountRs: formatPaise(template.amountPaise),
        expenseDate: expenseDate.toISOString().slice(0, 10),
      },
      entityType: 'expense',
      entityId: createdExpenseId,
    })
  } catch (err) {
    logger.warn('notify.failed', { eventKey: 'RECURRING_EXPENSE_PENDING', err })
  }

  return true
}

// ── Date helpers ────────────────────────────────────────────────────────────

/**
 * Advance `current` date forward past `now` by repeatedly calling
 * computeNextRunDate. Handles missed days (catch-up rule: only ONE
 * expense is created; dates skip forward until future).
 */
function advancePastNow(
  frequency: ExpenseFrequency,
  current: Date,
  now: Date,
  dayOfMonth?: number | null,
  dayOfWeek?: number | null,
): Date {
  let next = computeNextRunDate(frequency, current, dayOfMonth, dayOfWeek)

  // Skip forward until next run is strictly in the future
  while (next <= now) {
    next = computeNextRunDate(frequency, next, dayOfMonth, dayOfWeek)
  }

  return next
}
