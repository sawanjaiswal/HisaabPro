/**
 * Payment reminders — send single, list, config
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import logger from '../../lib/logger.js'
import { sendWhatsApp } from '../notification.service.js'
import type {
  SendReminderInput,
  ListRemindersQuery,
  UpdateReminderConfigInput,
} from '../../schemas/payment.schemas.js'

export async function sendReminder(
  businessId: string,
  _userId: string,
  data: SendReminderInput
) {
  const party = await prisma.party.findFirst({
    where: { id: data.partyId, businessId },
    select: { id: true, name: true, phone: true },
  })
  if (!party) throw notFoundError('Party')

  const defaultMessage = `Hi ${party.name}, this is a reminder about your outstanding payment. Please make the payment at your earliest convenience.`
  const message = data.message || defaultMessage

  // Create reminder as PENDING, then update after delivery attempt.
  // Not wrapped in $transaction because notification delivery involves external I/O.
  const reminder = await prisma.paymentReminder.create({
    data: {
      businessId,
      partyId: data.partyId,
      invoiceId: data.invoiceId || null,
      channel: data.channel,
      status: 'PENDING',
      message,
      sentAt: null,
      isAutomatic: false,
    },
    select: {
      id: true, channel: true, status: true, message: true,
      sentAt: true, isAutomatic: true, createdAt: true,
      party: { select: { id: true, name: true } },
    },
  })

  // Attempt actual delivery — never let notification failure crash the route
  try {
    let delivered = false

    if (data.channel === 'WHATSAPP' && party.phone) {
      const result = await sendWhatsApp({
        phone: party.phone,
        templateName: 'payment_reminder',
        templateParams: [party.name, message],
      })
      delivered = result.success
      if (!result.success) {
        logger.warn('Reminder WhatsApp delivery failed', {
          reminderId: reminder.id, error: result.error,
        })
      }
    } else if (data.channel === 'PUSH') {
      // TODO: Look up device tokens for party (requires device token storage)
      logger.info('Push reminder skipped — device token lookup not yet implemented', {
        reminderId: reminder.id,
      })
    }

    await prisma.paymentReminder.update({
      where: { id: reminder.id },
      data: {
        status: delivered ? 'SENT' : 'FAILED',
        sentAt: delivered ? new Date() : null,
        failureReason: delivered ? null : 'Delivery attempt unsuccessful',
      },
    })

    reminder.status = delivered ? 'SENT' : 'FAILED'
    reminder.sentAt = delivered ? new Date() : null
  } catch (err) {
    logger.error('Reminder notification dispatch error', {
      reminderId: reminder.id,
      error: err instanceof Error ? err.message : err,
    })
    await prisma.paymentReminder.update({
      where: { id: reminder.id },
      data: { status: 'FAILED', failureReason: 'Notification dispatch error' },
    })
    reminder.status = 'FAILED'
  }

  return reminder
}

export async function listReminders(businessId: string, query: ListRemindersQuery) {
  const { partyId, invoiceId, status, channel, dateFrom, dateTo, page, limit } = query

  const where: Record<string, unknown> = { businessId }
  if (partyId) where.partyId = partyId
  if (invoiceId) where.invoiceId = invoiceId
  if (status) where.status = { in: status.split(',').map(s => s.trim()) }
  if (channel) where.channel = channel
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo) }),
    }
  }

  const [reminders, total] = await Promise.all([
    prisma.paymentReminder.findMany({
      where,
      select: {
        id: true, channel: true, status: true, message: true,
        sentAt: true, failureReason: true, isAutomatic: true, createdAt: true,
        party: { select: { id: true, name: true } },
        invoice: { select: { id: true, documentNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.paymentReminder.count({ where }),
  ])

  return {
    reminders,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

export async function getReminderConfig(businessId: string) {
  const config = await prisma.reminderConfig.findUnique({
    where: { businessId },
  })
  return config || {
    businessId,
    enabled: true,
    autoRemindEnabled: false,
    frequencyDays: [1, 3, 7],
    maxRemindersPerInvoice: 5,
    defaultChannel: 'WHATSAPP',
    quietHoursStart: '21:00',
    quietHoursEnd: '09:00',
    whatsappTemplate: null,
    smsTemplate: null,
  }
}

export async function updateReminderConfig(
  businessId: string,
  data: UpdateReminderConfigInput
) {
  return prisma.reminderConfig.upsert({
    where: { businessId },
    create: { businessId, ...data },
    update: data,
  })
}
