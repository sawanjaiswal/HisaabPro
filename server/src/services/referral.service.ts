/**
 * Referral & Earn Service — Feature #3
 * Adapted from DudhHisaab referral module (stripped: milk fields, Sentry, branding strings)
 *
 * Covers:
 *   - Code generation (collision-safe, crypto-based)
 *   - Fraud detection: self-referral guard, double-apply guard
 *   - Reward lifecycle: in_review → approved (auto after 7 days) → withdrawn
 *   - Wallet: balanceInReview, availableBalance, totalEarned
 *   - Withdrawal: UPI stub (Razorpay wired up later)
 */

import crypto from 'crypto'
import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'
import type { ReferralCode } from '@prisma/client'

// ============================================================
// CONSTANTS (SSOT — not inline)
// ============================================================

const REWARD_AMOUNT = parseFloat(process.env.REFERRAL_REWARD_AMOUNT ?? '100')
const REVIEW_WINDOW_DAYS = parseInt(process.env.REFERRAL_REVIEW_WINDOW_DAYS ?? '7', 10)
const APP_URL = process.env.FRONTEND_URL ?? 'https://app.hisaabpro.in'
const MAX_CODE_RETRIES = 3

// ============================================================
// CODE GENERATION
// ============================================================

/**
 * Generate a URL-safe alphanumeric referral code.
 * Format: {NAME_PREFIX}{4 chars} — e.g. RAJU9K3M
 * Uses crypto.randomBytes for security, not Math.random.
 */
function generateCodeSuffix(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = crypto.randomBytes(4)
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('')
}

function buildNamePrefix(name: string): string {
  const sanitized = name
    .trim()
    .split(/\s+/)[0]
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 10)
  return sanitized || 'USER'
}

function buildReferralLink(code: string): string {
  return `${APP_URL}/register?ref=${code}`
}

/**
 * Generate unique referral code for a user.
 * Idempotent — returns existing code if already generated.
 */
export async function generateReferralCode(
  userId: string,
  userName: string | null
): Promise<ReferralCode> {
  const existing = await prisma.referralCode.findUnique({ where: { userId } })
  if (existing) return existing

  const prefix = buildNamePrefix(userName ?? 'User')

  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    const code = `${prefix}${generateCodeSuffix()}`

    const collision = await prisma.referralCode.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
    })
    if (collision) {
      logger.warn(`Referral code collision: ${code} (attempt ${attempt + 1}/${MAX_CODE_RETRIES})`)
      continue
    }

    const link = buildReferralLink(code)
    const record = await prisma.referralCode.create({
      data: { userId, code, link, totalReferrals: 0, successfulRewards: 0, totalEarned: 0 },
    })

    logger.info(`Referral code generated for user ${userId}: ${code}`)
    return record
  }

  throw new Error(`Failed to generate unique referral code after ${MAX_CODE_RETRIES} attempts`)
}

/**
 * Get referral code for a user (null if none generated yet).
 */
export async function getReferralCode(userId: string): Promise<ReferralCode | null> {
  return prisma.referralCode.findUnique({ where: { userId } })
}

/**
 * Resolve a code string to its owner info (case-insensitive).
 */
export async function resolveCode(
  code: string
): Promise<(ReferralCode & { user: { id: string; name: string | null; phone: string } }) | null> {
  return prisma.referralCode.findFirst({
    where: { code: { equals: code, mode: 'insensitive' } },
    include: { user: { select: { id: true, name: true, phone: true } } },
  })
}

// ============================================================
// FRAUD DETECTION
// ============================================================

/**
 * Apply referral code during signup / onboarding.
 * Fraud guards: self-referral, double-apply.
 */
export async function applyReferralCode(
  userId: string,
  referralCode: string,
  meta?: { ipAddress?: string; deviceFingerprint?: string }
): Promise<{ success: boolean; referrerName: string }> {
  const codeRecord = await resolveCode(referralCode)

  if (!codeRecord) {
    throw new Error('Invalid referral code')
  }

  const referrerId = codeRecord.userId

  // Fraud guard: self-referral
  if (referrerId === userId) {
    throw new Error('You cannot use your own referral code')
  }

  // Fraud guard: already used a code
  const applicant = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredBy: true },
  })
  if (!applicant) throw new Error('User not found')

  if (applicant.referredBy) {
    throw new Error('You have already used a referral code')
  }

  // Apply atomically: update user + create event + increment count
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { referredBy: referrerId },
    }),
    prisma.referralEvent.create({
      data: {
        referrerId,
        referredId: userId,
        eventType: 'signup',
        ipAddress: meta?.ipAddress,
        deviceFingerprint: meta?.deviceFingerprint,
        isSuspicious: false,
      },
    }),
    prisma.referralCode.update({
      where: { userId: referrerId },
      data: { totalReferrals: { increment: 1 } },
    }),
  ])

  logger.info(`User ${userId} referred by ${referrerId} via code ${referralCode}`)
  return { success: true, referrerName: codeRecord.user.name ?? 'Anonymous' }
}

// ============================================================
// REWARD LIFECYCLE
// ============================================================

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
          amount: REWARD_AMOUNT,
          status: 'in_review',
          eligibleAt,
        },
      }),
      prisma.user.update({
        where: { id: user.referredBy },
        data: { referralBalanceInReview: { increment: REWARD_AMOUNT } },
      }),
      prisma.referralCode.update({
        where: { userId: user.referredBy },
        data: { totalReferrals: { increment: 1 } },
      }),
    ])

    logger.info(
      `Referral reward queued: ₹${REWARD_AMOUNT} for referrer ${user.referredBy} ` +
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
  })

  if (eligible.length === 0) return { count: 0 }

  let successCount = 0

  for (const reward of eligible) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.referralReward.update({
          where: { id: reward.id },
          data: { status: 'approved', approvedAt: new Date() },
        })
        await tx.user.update({
          where: { id: reward.referrerId },
          data: {
            referralBalance: { increment: Number(reward.amount) },
            referralBalanceInReview: { decrement: Number(reward.amount) },
            referralTotalEarned: { increment: Number(reward.amount) },
          },
        })
        await tx.referralEvent.create({
          data: {
            referrerId: reward.referrerId,
            referredId: reward.referredId,
            eventType: 'reward_credited',
            eventData: { rewardId: reward.id, amount: Number(reward.amount) },
            isSuspicious: false,
          },
        })
        await tx.referralCode.update({
          where: { userId: reward.referrerId },
          data: {
            successfulRewards: { increment: 1 },
            totalEarned: { increment: Number(reward.amount) },
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

// ============================================================
// STATS & WALLET
// ============================================================

export interface ReferralStats {
  totalReferrals: number
  pendingReferrals: number
  qualifiedReferrals: number
  availableBalance: number
  balanceInReview: number
  totalEarned: number
  pendingWithdrawals: number
}

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

// ============================================================
// REWARDS LIST (paginated — cursor-based)
// ============================================================

export interface RewardListItem {
  id: string
  referredName: string
  referredPhone: string
  status: string
  amount: number
  earnedAt: string | null
  signupDate: string
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

// ============================================================
// WITHDRAWAL (UPI stub — Razorpay wired later)
// ============================================================

export async function requestWithdrawal(
  userId: string,
  amount: number,
  upiId: string
): Promise<{ withdrawalId: string; status: string; autoApproved: boolean; processingTime: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      referralBalance: true,
      walletFrozen: true,
      referralFraudFlags: true,
      referralWithdrawals: {
        where: { status: 'pending' },
        select: { id: true },
      },
    },
  })

  if (!user) throw new Error('User not found')
  if (user.walletFrozen) throw new Error('Wallet is frozen. Please contact support.')
  if (amount > Number(user.referralBalance))
    throw new Error(`Insufficient balance. Available: ₹${Number(user.referralBalance)}`)
  if (user.referralWithdrawals.length > 0)
    throw new Error('You already have a pending withdrawal request')

  // Frequency guard: 1 withdrawal per 7 days
  const recent = await prisma.referralWithdrawal.findFirst({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  })
  if (recent) throw new Error('You can only withdraw once every 7 days')

  // Auto-approve small amounts for clean users
  const totalWithdrawals = await prisma.referralWithdrawal.count({ where: { userId } })
  const autoApproved =
    amount < 1000 && totalWithdrawals < 5 && user.referralFraudFlags === 0

  const status = autoApproved ? 'approved' : 'pending'

  const withdrawal = await prisma.referralWithdrawal.create({
    data: { userId, amount, upiId, status, autoApproved },
  })

  if (autoApproved) {
    await prisma.user.update({
      where: { id: userId },
      data: { referralBalance: { decrement: amount } },
    })
  }

  logger.info(`Withdrawal request ${withdrawal.id} created (auto-approved: ${autoApproved})`)

  return {
    withdrawalId: withdrawal.id,
    status,
    autoApproved,
    processingTime: autoApproved ? '24 hours' : '2-3 business days',
  }
}

export async function listWithdrawals(
  userId: string,
  page = 1,
  limit = 10
): Promise<{
  items: Array<{
    id: string
    amount: number
    upiId: string
    status: string
    requestedAt: string
    processedAt: string | null
    autoApproved: boolean
  }>
  pagination: { page: number; limit: number; total: number; pages: number }
}> {
  const skip = (page - 1) * limit

  const [rows, total] = await Promise.all([
    prisma.referralWithdrawal.findMany({
      where: { userId },
      select: {
        id: true,
        amount: true,
        upiId: true,
        status: true,
        createdAt: true,
        processedAt: true,
        autoApproved: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.referralWithdrawal.count({ where: { userId } }),
  ])

  return {
    items: rows.map((w) => ({
      id: w.id,
      amount: Number(w.amount),
      upiId: w.upiId,
      status: w.status,
      requestedAt: w.createdAt.toISOString(),
      processedAt: w.processedAt?.toISOString() ?? null,
      autoApproved: w.autoApproved,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}
