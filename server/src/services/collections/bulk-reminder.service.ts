/**
 * Bulk Reminder Service — batch pre-flight, template render, ReminderLog dispatch.
 *
 * Security gates enforced here:
 *   MB-3: customMessage appended AFTER renderTemplate(), never fed through it.
 *   MB-4: phone validated via isValidPhone(); invalid phones → excluded bucket.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import { buildWaLink, maskPhone, isValidPhone } from '../../lib/wa-utils.js'
import { renderTemplate, type TemplateKey, type TemplateCtx } from './reminder-templates.js'
import { touchLastContactedMany } from '../party/last-contacted.service.js'

const MAX_BATCH = 50

export type ReminderChannel = 'WHATSAPP' | 'SMS'

export interface ReminderPartyResult {
  partyId: string
  name: string
  maskedPhone: string
  waLink: string
}

export interface ExcludedParty {
  partyId: string
  name: string
  reason: 'NO_PHONE' | 'INVALID_PHONE'
}

export interface BulkBatch {
  included: ReminderPartyResult[]
  excluded: ExcludedParty[]
  renderedMessages: Map<string, string> // partyId → final message
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPaise(paise: number): string {
  const rupees = Math.round(paise / 100)
  return `₹${rupees.toLocaleString('en-IN')}`
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return 'N/A'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Pre-flight + batch build ─────────────────────────────────────────────────

export async function buildBulkReminderBatch(
  businessId: string,
  partyIds: string[],
  templateKey: TemplateKey,
  customMessage: string | undefined,
): Promise<BulkBatch> {
  if (partyIds.length > MAX_BATCH) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      400,
      `Batch size ${partyIds.length} exceeds limit of ${MAX_BATCH}`,
      { code: 'BATCH_LIMIT_EXCEEDED', limit: MAX_BATCH },
    )
  }

  // Single query cross-tenant validation (MB-3 pre-flight)
  const parties = await prisma.party.findMany({
    where: { id: { in: partyIds }, businessId, isDeleted: false },
    select: {
      id: true,
      name: true,
      phone: true,
      outstandingBalance: true,
      lastTransactionAt: true,
    },
  })

  if (parties.length !== partyIds.length) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      400,
      'One or more party IDs are invalid or belong to a different business',
      { code: 'BATCH_VALIDATION_FAILED' },
    )
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  })
  const businessName = business?.name ?? 'Your Business'

  const included: ReminderPartyResult[] = []
  const excluded: ExcludedParty[] = []
  const renderedMessages = new Map<string, string>()

  for (const party of parties) {
    const rawPhone = party.phone ?? ''

    if (!rawPhone) {
      excluded.push({ partyId: party.id, name: party.name, reason: 'NO_PHONE' })
      continue
    }

    // MB-4: digits-only validation
    const digitsOnly = rawPhone.replace(/\D/g, '')
    if (!isValidPhone(digitsOnly)) {
      excluded.push({ partyId: party.id, name: party.name, reason: 'INVALID_PHONE' })
      logger.warn('bulk_reminder.invalid_phone', {
        partyId: party.id,
        maskedPhone: maskPhone(rawPhone),
      })
      continue
    }

    const ctx: TemplateCtx = {
      name: party.name,
      amount: formatPaise(party.outstandingBalance),
      business_name: businessName,
      due_date: formatDate(party.lastTransactionAt),
      oldest_invoice_date: formatDate(party.lastTransactionAt),
    }

    // MB-3: render first, then append customMessage as literal text
    let message = renderTemplate(templateKey, ctx)
    if (customMessage && customMessage.trim()) {
      message = `${message}\n\n${customMessage}` // never re-rendered
    }

    // MB-4: build wa.me link with validated digits-only phone
    const waLink = buildWaLink(digitsOnly, message)
    if (!waLink) {
      excluded.push({ partyId: party.id, name: party.name, reason: 'INVALID_PHONE' })
      continue
    }

    renderedMessages.set(party.id, message)
    included.push({
      partyId: party.id,
      name: party.name,
      maskedPhone: maskPhone(digitsOnly),
      waLink,
    })
  }

  return { included, excluded, renderedMessages }
}

// ─── Dispatch + ReminderLog write ─────────────────────────────────────────────

export async function dispatchBulkReminders(
  businessId: string,
  userId: string,
  batch: BulkBatch,
  partyPhoneMap: Map<string, string>, // partyId → validated digits-only phone
  templateKey: TemplateKey,
  bulkBatchId: string,
  outstandingMap: Map<string, number>, // partyId → outstandingBalance in paise
): Promise<{ sent: number; excluded: ExcludedParty[] }> {
  if (batch.included.length === 0) {
    return { sent: 0, excluded: batch.excluded }
  }

  // Single transaction: insert all ReminderLog rows + audit entries
  await prisma.$transaction(async (tx) => {
    const logData = batch.included.map((r) => ({
      businessId,
      partyId: r.partyId,
      origin: 'BULK',
      bulkBatchId,
      channel: 'WHATSAPP' as const,
      status: 'DISPATCHED' as const,
      renderedMessage: batch.renderedMessages.get(r.partyId) ?? '',
      templateKey,
      recipientPhone: partyPhoneMap.get(r.partyId) ?? null,
      snapshotOutstandingPaise: outstandingMap.get(r.partyId) ?? 0,
      dispatchedAt: new Date(),
      createdBy: userId,
    }))

    await tx.reminderLog.createMany({ data: logData })

    // Audit log per reminder (masked phone — MB-4)
    const auditData = batch.included.map((r) => ({
      businessId,
      action: 'REMINDER_DISPATCHED',
      entityType: 'ReminderLog',
      entityId: r.partyId,
      entityLabel: r.name,
      userId,
      changes: {
        channel: 'WHATSAPP',
        templateKey,
        bulkBatchId,
        recipientPhone: r.maskedPhone, // masked
      },
    }))

    await tx.auditLog.createMany({ data: auditData })

    // CRM #127 — bulk touch lastContactedAt in the same tx (architecture §3.5).
    await touchLastContactedMany(
      businessId,
      batch.included.map((r) => r.partyId),
      tx,
    )
  })

  logger.info('bulk_reminder.dispatched', {
    businessId,
    userId,
    bulkBatchId,
    sent: batch.included.length,
    excluded: batch.excluded.length,
  })

  return { sent: batch.included.length, excluded: batch.excluded }
}
