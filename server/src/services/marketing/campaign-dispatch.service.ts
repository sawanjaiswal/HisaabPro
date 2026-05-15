/**
 * Campaign Dispatch Service — launch orchestration (PR4)
 * Atomic: cost-cap → segment → materialise recipients (chunks 500) → enqueue
 * Belt-and-braces opt-out at segment resolution + per-recipient (enqueue service).
 */

import { prisma } from '../../lib/prisma.js'
import { resolvePartyIds } from './campaign-segment.service.js'
import { assertWithinCap, CostCapExceededError } from './marketing-cost-cap.service.js'
import { enqueueAllRecipients } from './campaign-enqueue.service.js'
import logger from '../../lib/logger.js'
import type { SegmentFilter } from './campaign-segment.types.js'

export { CostCapExceededError }

const MATERIALISE_CHUNK = 500

export async function launchCampaign(
  campaignId: string,
  businessId: string,
  actorUserId: string,
  actorRole: string,
): Promise<{ recipientCount: number; status: string }> {
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id: campaignId, businessId, isDeleted: false },
    include: { template: true },
  })

  if (!campaign) throw Object.assign(new Error('Campaign not found'), { statusCode: 404, code: 'NOT_FOUND' })

  // Idempotent — already launched
  if (['RUNNING', 'SCHEDULED', 'COMPLETED'].includes(campaign.status)) {
    return { recipientCount: campaign.recipientCount, status: campaign.status }
  }

  if (campaign.status !== 'DRAFT') {
    throw Object.assign(new Error('Campaign cannot be launched from current status'), { statusCode: 409, code: 'INVALID_TRANSITION' })
  }

  // Gate 1: DLT/WA compliance
  if (campaign.channel === 'SMS' && !campaign.template.dltTemplateId) {
    throw Object.assign(new Error('DLT Template ID required for SMS campaign'), { statusCode: 400, code: 'TEMPLATE_DLT_MISSING' })
  }
  if (campaign.channel === 'WHATSAPP' && !campaign.template.waTemplateName) {
    throw Object.assign(new Error('WhatsApp template name required'), { statusCode: 400, code: 'TEMPLATE_WA_NAME_MISSING' })
  }
  if (campaign.channel === 'WHATSAPP' && campaign.template.waTemplateStatus !== 'APPROVED') {
    throw Object.assign(new Error('WhatsApp template must be APPROVED'), { statusCode: 400, code: 'TEMPLATE_WA_NOT_APPROVED' })
  }

  const { partyIds, tooLarge } = await resolvePartyIds(businessId, campaign.segmentFilter as SegmentFilter)

  if (tooLarge) throw Object.assign(new Error('Segment exceeds 10,000 recipients'), { statusCode: 400, code: 'SEGMENT_TOO_LARGE' })
  if (partyIds.length === 0) throw Object.assign(new Error('No customers match segment'), { statusCode: 400, code: 'SEGMENT_EMPTY' })

  // Gate 2: pre-launch cost cap
  await assertWithinCap(businessId, campaign.channel, partyIds.length)

  const targetStatus = campaign.scheduledAt && campaign.scheduledAt > new Date() ? 'SCHEDULED' : 'RUNNING'
  await prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: { status: targetStatus, startedAt: new Date(), recipientCount: partyIds.length },
  })

  await prisma.auditLog.create({
    data: {
      businessId,
      userId: actorUserId,
      action: 'UPDATE',
      entityType: 'marketing_campaign',
      entityId: campaignId,
      entityLabel: campaign.name,
      changes: { actorUserId, actorRole, recipientCount: partyIds.length, channel: campaign.channel, action: 'LAUNCH' },
    },
  })

  // Materialise recipients in chunks
  // P3.13 — defense-in-depth: partyIds come from resolvePartyIds(businessId,...)
  // so already tenant-scoped, but explicit businessId on the where prevents
  // future refactor from breaking the invariant.
  const parties = await prisma.party.findMany({
    where: { id: { in: partyIds }, businessId },
    select: { id: true, phone: true },
  })

  for (let i = 0; i < parties.length; i += MATERIALISE_CHUNK) {
    const chunk = parties.slice(i, i + MATERIALISE_CHUNK)
    await prisma.marketingCampaignRecipient.createMany({
      data: chunk.map((p) => ({ campaignId, partyId: p.id, phone: p.phone, status: 'QUEUED' as const })),
      skipDuplicates: true,
    })
  }

  // Fire-and-forget
  void enqueueAllRecipients(campaignId, businessId, campaign.channel, campaign.template)
    .catch((err) => logger.error('marketing.dispatch.enqueue_error', { campaignId, error: String(err) }))

  logger.info('marketing.campaign.launched', { campaignId, businessId, actorUserId, recipientCount: partyIds.length })
  return { recipientCount: partyIds.length, status: targetStatus }
}

export async function cancelCampaign(
  campaignId: string,
  businessId: string,
  actorUserId: string,
  actorRole: string,
): Promise<{ status: string }> {
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id: campaignId, businessId, isDeleted: false },
  })
  if (!campaign) throw Object.assign(new Error('Campaign not found'), { statusCode: 404, code: 'NOT_FOUND' })
  if (campaign.status === 'CANCELLED') throw Object.assign(new Error('Already cancelled'), { statusCode: 409, code: 'INVALID_TRANSITION' })
  if (!['DRAFT', 'SCHEDULED', 'RUNNING'].includes(campaign.status)) {
    throw Object.assign(new Error('Cannot cancel from current status'), { statusCode: 409, code: 'INVALID_TRANSITION' })
  }

  await prisma.marketingCampaign.update({ where: { id: campaignId }, data: { status: 'CANCELLED', updatedAt: new Date() } })
  await prisma.marketingCampaignRecipient.updateMany({
    where: { campaignId, status: 'QUEUED' },
    data: { status: 'SKIPPED', skipReason: 'campaign_cancelled' },
  })

  await prisma.auditLog.create({
    data: {
      businessId, userId: actorUserId, action: 'UPDATE',
      entityType: 'marketing_campaign', entityId: campaignId, entityLabel: campaign.name,
      changes: { actorUserId, actorRole, action: 'CANCEL' },
    },
  })

  logger.info('marketing.campaign.cancelled', { campaignId, businessId, actorUserId })
  return { status: 'CANCELLED' }
}
