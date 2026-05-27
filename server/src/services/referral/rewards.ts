/**
 * Reward lifecycle: subscription payment hook + cron-driven approval.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'

// Reward amount in paise (paise is the only SSOT post-PR3).
const REWARD_AMOUNT_PAISE = Math.round(parseFloat(process.env.REFERRAL_REWARD_AMOUNT ?? '100') * 100)
const REVIEW_WINDOW_DAYS = parseInt(process.env.REFERRAL_REVIEW_WINDOW_DAYS ?? '7', 10)

/**
 * Trigger reward flow when a referred user makes their first subscription payment.
 * Creates IN_REVIEW reward, moves funds to balanceInReview.
 * Called by payment webhook / subscription handler.
 */
export async function handleSubscriptionPayment(params: {
  userId: string
  paymentAmount: number
  subscriptionPlan: string
}): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { referredBy: true },
    })
    if (!user?.referredBy) return // not referred

    // Deduplicate: one reward per referral pair
    const exists = await prisma.referralReward.findFirst({
      where: {
        referrerId: user.referredBy,
        referredId: params.userId,
        status: { in: ['in_review', 'approved', 'withdrawn'] },
      },
    })
    if (exists) return

    const eligibleAt = new Date()
    eligibleAt.setDate(eligibleAt.getDate() + REVIEW_WINDOW_DAYS)

    await prisma.$transaction([
      prisma.referralEvent.create({
        data: {
          referrerId: user.referredBy,
          referredId: params.userId,
          eventType: 'payment_success',
          eventData: {
            paymentAmount: params.paymentAmount,
            subscriptionPlan: params.subscriptionPlan,
          },
          isSuspicious: false,
        },
      }),
      prisma.referralReward.create({
        data: {
          referrerId: user.referredBy,
          referredId: params.userId,
          amountPaise: REWARD_AMOUNT_PAISE,
          status: 'in_review',
          eligibleAt,
        },
      }),
      prisma.user.update({
        where: { id: user.referredBy },
        data: { referralBalanceInReviewPaise: { increment: REWARD_AMOUNT_PAISE } },
      }),
    ])

    logger.info(
      `Referral reward queued: ₹${REWARD_AMOUNT_PAISE / 100} for referrer ${user.referredBy} ` +
        `(eligible: ${eligibleAt.toISOString()})`
    )
  } catch (err) {
    // Non-fatal — never fail the payment because of referral
    logger.error('Error processing referral payment hook:', err)
  }
}

/**
 * Process eligible rewards (cron job task — run daily).
 * Moves in_review → approved after review window passes.
 * Updates wallet balances and referral code stats.
 */
export async function processEligibleRewards(): Promise<{ count: number }> {
  const eligible = await prisma.referralReward.findMany({
    where: {
      status: 'in_review',
      eligibleAt: { lte: new Date() },
    },
    select: { id: true, referrerId: true, referredId: true, amountPaise: true },
  })

  if (eligible.length === 0) return { count: 0 }

  let successCount = 0

  for (const reward of eligible) {
    try {
      const rewardPaise = reward.amountPaise
      await prisma.$transaction(async (tx) => {
        await tx.referralReward.update({
          where: { id: reward.id },
          data: { status: 'approved', approvedAt: new Date() },
        })
        await tx.user.update({
          where: { id: reward.referrerId },
          data: {
            referralBalancePaise: { increment: rewardPaise },
            referralBalanceInReviewPaise: { decrement: rewardPaise },
            referralTotalEarnedPaise: { increment: BigInt(rewardPaise) },
          },
        })
        await tx.referralEvent.create({
          data: {
            referrerId: reward.referrerId,
            referredId: reward.referredId,
            eventType: 'reward_credited',
            eventData: { rewardId: reward.id, amountPaise: rewardPaise },
            isSuspicious: false,
          },
        })
        await tx.referralCode.update({
          where: { userId: reward.referrerId },
          data: {
            successfulRewards: { increment: 1 },
            totalEarnedPaise: { increment: BigInt(rewardPaise) },
          },
        })
      })
      successCount++
    } catch (err) {
      logger.error(`Failed to approve reward ${reward.id}:`, err)
    }
  }

  logger.info(`processEligibleRewards: ${successCount}/${eligible.length} approved`)
  return { count: successCount }
}
