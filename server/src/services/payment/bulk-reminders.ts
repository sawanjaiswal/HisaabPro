/**
 * Bulk payment reminder delivery
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { sendWhatsApp } from '../notification.service.js'
import type { SendBulkRemindersInput } from '../../schemas/payment.schemas.js'

export async function sendBulkReminders(
  businessId: string,
  _userId: string,
  data: SendBulkRemindersInput
) {
  const parties = await prisma.party.findMany({
    where: { id: { in: data.partyIds }, businessId },
    select: { id: true, name: true, phone: true },
  })
  const partyMap = new Map(parties.map(p => [p.id, p]))

  // Partition into valid (found) and invalid (not found) party IDs
  const validPartyIds = data.partyIds.filter(id => partyMap.has(id))
  const invalidPartyIds = data.partyIds.filter(id => !partyMap.has(id))

  const now = new Date()

  // Create all reminder records as PENDING
  if (validPartyIds.length > 0) {
    await prisma.paymentReminder.createMany({
      data: validPartyIds.map(partyId => {
        const party = partyMap.get(partyId)!
        return {
          businessId,
          partyId,
          channel: data.channel,
          status: 'PENDING',
          message: data.message || `Hi ${party.name}, this is a reminder about your outstanding payment.`,
          sentAt: null,
          isAutomatic: false,
        }
      }),
    })
  }

  // Attempt delivery for each valid party
  const results: Array<{ partyId: string; status: 'sent' | 'failed'; error?: string }> = [
    ...invalidPartyIds.map(partyId => ({ partyId, status: 'failed' as const, error: 'Party not found' })),
  ]

  // Fetch the reminder records we just created to get their IDs
  const reminders = validPartyIds.length > 0
    ? await prisma.paymentReminder.findMany({
        where: { businessId, partyId: { in: validPartyIds }, createdAt: { gte: now } },
        select: { id: true, partyId: true, message: true },
      })
    : []
  const reminderByParty = new Map(reminders.map(r => [r.partyId, r]))

  const deliveryTasks = validPartyIds.map(async (partyId) => {
    const party = partyMap.get(partyId)!
    const reminder = reminderByParty.get(partyId)
    try {
      let delivered = false

      if (data.channel === 'WHATSAPP' && party.phone) {
        const result = await sendWhatsApp({
          phone: party.phone,
          templateName: 'payment_reminder',
          templateParams: [party.name, reminder?.message ?? ''],
        })
        delivered = result.success
      }

      if (reminder) {
        await prisma.paymentReminder.update({
          where: { id: reminder.id },
          data: {
            status: delivered ? 'SENT' : 'FAILED',
            sentAt: delivered ? new Date() : null,
            failureReason: delivered ? null : 'Delivery unsuccessful',
          },
        })
      }

      results.push({
        partyId,
        status: delivered ? 'sent' : 'failed',
        error: delivered ? undefined : 'Delivery unsuccessful',
      })
    } catch (err) {
      logger.error('Bulk reminder delivery error', {
        partyId,
        error: err instanceof Error ? err.message : err,
      })
      if (reminder) {
        await prisma.paymentReminder.update({
          where: { id: reminder.id },
          data: { status: 'FAILED', failureReason: 'Notification dispatch error' },
        }).catch(() => { /* swallow update failure — already logged */ })
      }
      results.push({ partyId, status: 'failed', error: 'Notification dispatch error' })
    }
  })

  await Promise.all(deliveryTasks)

  const sentCount = results.filter(r => r.status === 'sent').length
  const failedCount = results.filter(r => r.status === 'failed').length

  return {
    sent: sentCount,
    failed: failedCount,
    results,
  }
}
