/**
 * Marketing Cost Cap Service (PR4)
 * Pre-launch cost estimate vs business monthly cap.
 * Per ARCHITECTURE §8: called before any recipient rows are written.
 */

import { getPlanTier, PLAN_CAPS_PAISE } from '../notifications/notification-cost.service.js'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'

const COST_PER_MSG: Record<string, number> = {
  WHATSAPP: 50,
  SMS: 25,
}

function currentMonthIST(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).slice(0, 7)
}

export class CostCapExceededError extends Error {
  readonly statusCode = 402
  readonly code = 'COST_CAP_EXCEEDED'
  readonly estimatePaise: number
  readonly remainingPaise: number

  constructor(estimatePaise: number, remainingPaise: number) {
    super('Estimated campaign cost exceeds monthly cap')
    this.estimatePaise = estimatePaise
    this.remainingPaise = remainingPaise
  }
}

export async function assertWithinCap(
  businessId: string,
  channel: string,
  recipientCount: number,
): Promise<void> {
  const perMsg = COST_PER_MSG[channel] ?? 25
  const estimate = perMsg * recipientCount

  const planTier = await getPlanTier(businessId)
  const cap = PLAN_CAPS_PAISE[planTier.toUpperCase()] ?? PLAN_CAPS_PAISE['FREE']!
  const month = currentMonthIST()

  // Sum spent across all channels for this business this month
  const tallies = await prisma.notificationCostTally.findMany({
    where: { businessId, month },
    select: { totalPaise: true },
  })
  const spentThisMonth = tallies.reduce((sum, t) => sum + t.totalPaise, 0)

  if (spentThisMonth + estimate > cap) {
    logger.warn('marketing.cost_cap.exceeded', {
      businessId,
      channel,
      recipientCount,
      estimate,
      spentThisMonth,
      cap,
    })
    throw new CostCapExceededError(estimate, Math.max(0, cap - spentThisMonth))
  }
}
