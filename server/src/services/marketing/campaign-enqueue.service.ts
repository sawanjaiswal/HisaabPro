/**
 * Campaign Enqueue Service — fire-and-forget per-recipient dispatch (PR4)
 * Called from campaign-dispatch.service after materialising recipients.
 * Security: job payload MUST NOT include phone number (verified inline).
 */

import { prisma } from '../../lib/prisma.js'
import { notificationManager } from '../notifications/notification-manager.js'
import { dropOptedOut } from './marketing-compliance.service.js'
import { CampaignCounterBuffer } from './campaign-counter.service.js'
import logger from '../../lib/logger.js'

const DISPATCH_CHUNK = 200

export async function enqueueAllRecipients(
  campaignId: string,
  businessId: string,
  channel: string,
  template: { id: string; dltTemplateId: string | null; waTemplateName: string | null },
): Promise<void> {
  const counter = new CampaignCounterBuffer()
  let cursor: string | undefined

  while (true) {
    const recipients = await prisma.marketingCampaignRecipient.findMany({
      where: { campaignId, status: 'QUEUED' },
      select: { id: true, partyId: true, phone: true },
      take: DISPATCH_CHUNK,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    })

    if (recipients.length === 0) break

    const partyIds = recipients.map((r) => r.partyId)
    const eligible = await dropOptedOut(partyIds)

    for (const r of recipients) {
      if (!eligible.has(r.partyId)) {
        await prisma.marketingCampaignRecipient.update({
          where: { id: r.id },
          data: { status: 'SKIPPED', skipReason: 'opted_out' },
        })
        continue
      }

      if (!r.phone) {
        await prisma.marketingCampaignRecipient.update({
          where: { id: r.id },
          data: { status: 'SKIPPED', skipReason: 'no_phone' },
        })
        continue
      }

      // Build job payload — phone must NOT be in payload (security)
      const jobPayload = {
        channel,
        entityType: 'campaign_recipient',
        entityId: r.id,
        recipientPartyId: r.partyId,
        templateOverride: { marketingTemplateId: template.id },
        smsDltTemplateId: template.dltTemplateId,
        waTemplateName: template.waTemplateName,
      }

      // Security: phone must not appear in serialised payload
      if (JSON.stringify(jobPayload).includes(r.phone)) {
        logger.error('marketing.dispatch.phone_in_payload', { recipientId: r.id })
        await prisma.marketingCampaignRecipient.update({
          where: { id: r.id },
          data: { status: 'SKIPPED', skipReason: 'internal_error' },
        })
        continue
      }

      try {
        await notificationManager.notify(
          channel === 'WHATSAPP' ? 'MARKETING_CAMPAIGN_WHATSAPP' : 'MARKETING_CAMPAIGN_SMS',
          {
            businessId,
            userId: r.partyId,
            eventKey: channel === 'WHATSAPP' ? 'MARKETING_CAMPAIGN_WHATSAPP' : 'MARKETING_CAMPAIGN_SMS',
            locale: 'en',
            vars: { campaignId, recipientId: r.id },
            entityType: 'campaign_recipient',
            entityId: r.id,
          },
        )
        const costPaise = channel === 'WHATSAPP' ? 50 : 25
        await prisma.marketingCampaignRecipient.update({
          where: { id: r.id },
          data: { status: 'SENT', dispatchedAt: new Date(), costPaise },
        })
        counter.inc(campaignId, 'sent', costPaise)
      } catch {
        await prisma.marketingCampaignRecipient.update({
          where: { id: r.id },
          data: { status: 'FAILED', failedAt: new Date() },
        })
        counter.inc(campaignId, 'failed', 0)
      }
    }

    await counter.flush()
    cursor = recipients[recipients.length - 1]?.id
    if (recipients.length < DISPATCH_CHUNK) break
  }

  const pending = await prisma.marketingCampaignRecipient.count({
    where: { campaignId, status: 'QUEUED' },
  })
  if (pending === 0) {
    await prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
  }
}
