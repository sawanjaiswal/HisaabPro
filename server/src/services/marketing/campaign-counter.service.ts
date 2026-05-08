/**
 * Campaign Counter Service (PR4 + PR6)
 * Atomic { increment } updates — no read-modify-write.
 * Used by dispatch flow and webhook handlers.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'

// Per ARCHITECTURE §5.3: buffer and flush every 200 rows
export class CampaignCounterBuffer {
  private buf = new Map<string, { sent: number; failed: number; cost: number }>()

  inc(campaignId: string, kind: 'sent' | 'failed' | 'skipped', costPaise: number): void {
    const cur = this.buf.get(campaignId) ?? { sent: 0, failed: 0, cost: 0 }
    if (kind === 'sent') {
      cur.sent += 1
      cur.cost += costPaise
    } else if (kind === 'failed') {
      cur.failed += 1
    }
    this.buf.set(campaignId, cur)
  }

  async flush(): Promise<void> {
    for (const [cid, v] of this.buf) {
      await prisma.marketingCampaign.update({
        where: { id: cid },
        data: {
          sentCount: { increment: v.sent },
          failedCount: { increment: v.failed },
          totalCostPaise: { increment: v.cost },
        },
      })
    }
    this.buf.clear()
  }
}

// Webhook event handler — applies DELIVERED / FAILED updates
export async function applyWebhookEvent(
  recipientId: string,
  status: 'DELIVERED' | 'READ' | 'FAILED' | 'SENT',
): Promise<void> {
  const recipient = await prisma.marketingCampaignRecipient.findUnique({
    where: { id: recipientId },
    select: { campaignId: true, status: true },
  })

  if (!recipient) return

  if (status === 'DELIVERED') {
    await prisma.$transaction([
      prisma.marketingCampaign.update({
        where: { id: recipient.campaignId },
        data: { deliveredCount: { increment: 1 } },
      }),
      prisma.marketingCampaignRecipient.update({
        where: { id: recipientId },
        data: { dispatchedAt: new Date() },
      }),
    ])
  } else if (status === 'FAILED' && recipient.status === 'SENT') {
    // Transition SENT → FAILED: swap counters
    await prisma.$transaction([
      prisma.marketingCampaign.update({
        where: { id: recipient.campaignId },
        data: {
          failedCount: { increment: 1 },
          sentCount: { increment: -1 },
        },
      }),
      prisma.marketingCampaignRecipient.update({
        where: { id: recipientId },
        data: { status: 'FAILED', failedAt: new Date() },
      }),
    ])
  }

  logger.debug('marketing.counter.webhook_applied', { recipientId, status })
}
