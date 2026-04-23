/**
 * Referral stats, wallet balances, and paginated rewards list.
 */

import { prisma } from '../../lib/prisma.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReferralStats {
  totalReferrals: number
  pendingReferrals: number
  qualifiedReferrals: number
  availableBalance: number
  balanceInReview: number
  totalEarned: number
  pendingWithdrawals: number
}

export interface RewardListItem {
  id: string
  referredName: string
  referredPhone: string
  status: string
  amount: number
  earnedAt: string | null
  signupDate: string
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const [user, codeRecord, pendingReferrals, qualifiedReferrals, pendingWithdrawals] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          referralBalance: true,
          referralBalanceInReview: true,
          referralTotalEarned: true,
        },
      }),
      prisma.referralCode.findUnique({
        where: { userId },
        select: { totalReferrals: true },
      }),
      prisma.referralReward.count({
        where: { referrerId: userId, status: 'in_review' },
      }),
      prisma.referralReward.count({
        where: { referrerId: userId, status: { in: ['approved', 'withdrawn'] } },
      }),
      prisma.referralWithdrawal.count({
        where: { userId, status: 'pending' },
      }),
    ])

  if (!user) throw new Error('User not found')

  return {
    totalReferrals: codeRecord?.totalReferrals ?? 0,
    pendingReferrals,
    qualifiedReferrals,
    availableBalance: Number(user.referralBalance),
    balanceInReview: Number(user.referralBalanceInReview),
    totalEarned: Number(user.referralTotalEarned),
    pendingWithdrawals,
  }
}

export async function listRewards(
  referrerId: string,
  cursor?: string,
  limit = 20
): Promise<{ items: RewardListItem[]; nextCursor: string | null; total: number }> {
  const [rewards, total] = await Promise.all([
    prisma.referralReward.findMany({
      where: { referrerId },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { createdAt: 'desc' },
      include: {
        referred: { select: { name: true, phone: true, createdAt: true } },
      },
    }),
    prisma.referralReward.count({ where: { referrerId } }),
  ])

  const hasMore = rewards.length > limit
  const page = hasMore ? rewards.slice(0, limit) : rewards
  const nextCursor = hasMore ? page[page.length - 1].id : null

  const items: RewardListItem[] = page.map((r) => ({
    id: r.id,
    referredName: r.referred.name ?? 'Anonymous',
    // Mask phone: 98****56
    referredPhone: r.referred.phone
      ? `${r.referred.phone.slice(0, 2)}****${r.referred.phone.slice(-2)}`
      : 'N/A',
    status: r.status,
    amount: Number(r.amount),
    earnedAt: r.approvedAt?.toISOString() ?? null,
    signupDate: r.referred.createdAt.toISOString(),
  }))

  return { items, nextCursor, total }
}
