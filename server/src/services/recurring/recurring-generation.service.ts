/**
 * Per-schedule invoice generation — the core of the recurring system.
 *
 * Flow per schedule:
 *  1. Load template + party (outside tx).
 *  2. Build idempotencyKey; INSERT RecurringInvoiceRun (RUNNING).
 *     Unique collision → SKIPPED (no double-generation).
 *  3. generateNextNumber → clone Document + line items + charges.
 *  4. Advance nextRunDate; flip to COMPLETED if past endDate.
 *  5. Update run row to SUCCESS. Release claim.
 *  On failure: write FAILED run row, release claim.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { generateNextNumber } from '../document-number.service.js'
import logger from '../../lib/logger.js'
import { computeNextRunDate } from './recurring-date-math.js'
import { TEMPLATE_SELECT, cloneLineItems, cloneAdditionalCharges } from './clone.js'
import { buildRecurringDocumentData } from './recurring-doc-builder.js'
import { releaseSchedule } from './recurring-claim.service.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerateResult {
  runId: string
  documentId: string | null
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED'
  error?: string
  warning?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildIdempotencyKey(scheduleId: string, scheduledFor: Date, manual: boolean): string {
  const dateStr = scheduledFor.toISOString().slice(0, 10)
  return manual ? `${scheduleId}_manual_${dateStr}` : `${scheduleId}_${dateStr}`
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate one invoice for a given recurring schedule.
 * Safe to call from cron or manual trigger.
 */
export async function generateInvoiceForSchedule(
  scheduleId: string,
  opts: { manual: boolean; actorUserId?: string },
): Promise<GenerateResult> {
  const triggeredBy = opts.actorUserId ?? 'cron'

  const schedule = await prisma.recurringInvoice.findFirst({
    where: { id: scheduleId, isDeleted: false },
    select: {
      id: true, businessId: true, templateDocumentId: true, partyId: true,
      frequency: true, endDate: true, nextRunDate: true,
      dayOfMonth: true, dayOfWeek: true, generatedCount: true,
      autoSend: true, autoPaymentLink: true, autoReminder: true,
    },
  })

  if (!schedule) {
    return { runId: '', documentId: null, status: 'FAILED', error: 'Schedule not found' }
  }

  const now = new Date()
  const scheduledFor = new Date(schedule.nextRunDate)
  scheduledFor.setUTCHours(0, 0, 0, 0)

  const idempotencyKey = buildIdempotencyKey(schedule.id, scheduledFor, opts.manual)

  const template = await prisma.document.findFirst({
    where: { id: schedule.templateDocumentId, businessId: schedule.businessId },
    select: TEMPLATE_SELECT,
  })

  if (!template) {
    return {
      runId: '',
      documentId: null,
      status: 'FAILED',
      error: `Template document ${schedule.templateDocumentId} not found`,
    }
  }

  // GSTIN audit (snapshot Phase 1 — log only)
  const party = await prisma.party.findUnique({
    where: { id: schedule.partyId },
    select: { gstin: true, phone: true },
  })

  logger.info('recurring.generation.gstin_audit', {
    scheduleId,
    partyId: schedule.partyId,
    currentPartyGstin: party?.gstin ?? null,
  })

  const documentDate = new Date(now)
  documentDate.setUTCHours(0, 0, 0, 0)

  try {
    const result = await prisma.$transaction(async (tx) => {
      let runRow: { id: string }
      try {
        runRow = await tx.recurringInvoiceRun.create({
          data: {
            recurringInvoiceId: schedule.id,
            businessId: schedule.businessId,
            scheduledFor,
            status: 'RUNNING' as string,
            idempotencyKey,
            triggeredBy,
            retryCount: 0,
          },
          select: { id: true },
        })
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          return { runId: idempotencyKey, documentId: null, status: 'SKIPPED' as const }
        }
        throw e
      }

      const numberData = await generateNextNumber(
        tx, schedule.businessId, template.type, documentDate,
      )

      const newDoc = await tx.document.create({
        data: buildRecurringDocumentData(schedule, template, documentDate, numberData),
        select: { id: true },
      })

      await cloneLineItems(tx as never, newDoc.id, template.lineItems)
      await cloneAdditionalCharges(tx as never, newDoc.id, template.additionalCharges)

      const anchorDay = schedule.frequency === 'WEEKLY'
        ? schedule.dayOfWeek
        : schedule.dayOfMonth

      const nextRunDate = computeNextRunDate(
        schedule.nextRunDate, schedule.frequency, anchorDay,
      )
      const isExpired = schedule.endDate != null && nextRunDate > schedule.endDate

      await tx.recurringInvoice.update({
        where: { id: schedule.id },
        data: {
          nextRunDate,
          generatedCount: { increment: 1 },
          lastGeneratedAt: now,
          claimedAt: null,
          claimedBy: null,
          ...(isExpired && { status: 'COMPLETED' }),
        },
      })

      await tx.recurringInvoiceRun.update({
        where: { id: runRow.id },
        data: { status: 'SUCCESS', generatedDocumentId: newDoc.id, ranAt: now },
      })

      return { runId: runRow.id, documentId: newDoc.id, status: 'SUCCESS' as const }
    })

    // Post-commit: autoSend check (best-effort, outside tx)
    if (result.status === 'SUCCESS' && schedule.autoSend && !party?.phone) {
      await prisma.recurringInvoiceRun.update({
        where: { id: result.runId },
        data: { warning: 'autoSend_skipped_no_phone', status: 'SUCCESS_PARTIAL' },
      })
      logger.warn('recurring.generation.autoSend_skipped_no_phone', {
        scheduleId, partyId: schedule.partyId,
      })
      return { ...result, warning: 'autoSend_skipped_no_phone' }
    }

    logger.info('recurring.generation.complete', { scheduleId, ...result })
    return result
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.error('recurring.generation.error', { scheduleId, error: message })

    try {
      const failedRun = await prisma.recurringInvoiceRun.create({
        data: {
          recurringInvoiceId: schedule.id,
          businessId: schedule.businessId,
          scheduledFor,
          status: 'FAILED',
          idempotencyKey: `${idempotencyKey}_err_${Date.now()}`,
          triggeredBy,
          errorMessage: message.slice(0, 500),
          retryCount: 0,
        },
        select: { id: true },
      })
      await prisma.recurringInvoice.update({
        where: { id: schedule.id },
        data: { lastFailureReason: message.slice(0, 500), claimedAt: null, claimedBy: null },
      })
      return { runId: failedRun.id, documentId: null, status: 'FAILED', error: message }
    } catch {
      await releaseSchedule(scheduleId).catch(() => void 0)
      return { runId: '', documentId: null, status: 'FAILED', error: message }
    }
  }
}
