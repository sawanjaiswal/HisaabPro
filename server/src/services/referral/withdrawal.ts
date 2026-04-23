/**
 * Withdrawal: request, list, UPI masking, row-lock TOCTOU protection.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { encrypt, decrypt } from '../../lib/encryption.js'

// ── Types ────────────────────────────────────────────────────────────────────

interface WithdrawalRow {
  id: string
  amount: number
  upiId: string
  status: string
  requestedAt: string
  processedAt: string | null
  autoApproved: boolean
}

interface WithdrawalListResult {
  items: WithdrawalRow[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function requestWithdrawal(
  userId: string,
  amount: number,
  upiId: string
): Promise<{ withdrawalId: string; status: string; autoApproved: boolean; processingTime: string }> {
  // Use interactive transaction with row lock to prevent TOCTOU race
  return prisma.$transaction(async (tx) => {
    // Lock user row to prevent concurrent withdrawal requests
    const [user] = await tx.$queryRaw<
      Array<{ referral_balance: number; wallet_frozen: boolean; referral_fraud_flags: number }>
    >`SELECT "referralBalance" as referral_balance, "walletFrozen" as wallet_frozen, "referralFraudFlags" as referral_fraud_flags
      FROM "User" WHERE id = ${userId} FOR UPDATE`

    if (!user) throw new Error('User not found')
    if (user.wallet_frozen) throw new Error('Wallet is frozen. Please contact support.')
    if (amount > Number(user.referral_balance))
      throw new Error(`Insufficient balance. Available: ₹${Number(user.referral_balance)}`)

    // Check pending withdrawals (within the lock)
    const pendingCount = await tx.referralWithdrawal.count({
      where: { userId, status: 'pending' },
    })
    if (pendingCount > 0)
      throw new Error('You already have a pending withdrawal request')

    // Frequency guard: 1 withdrawal per 7 days
    const recent = await tx.referralWithdrawal.findFirst({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    })
    if (recent) throw new Error('You can only withdraw once every 7 days')

    // Auto-approve small amounts for clean users
    const totalWithdrawals = await tx.referralWithdrawal.count({ where: { userId } })
    const autoApproved =
      amount < 1000 && totalWithdrawals < 5 && user.referral_fraud_flags === 0

    const status = autoApproved ? 'approved' : 'pending'

    // Encrypt UPI ID at rest (PII protection)
    const encryptedUpiId = process.env.ENCRYPTION_KEY ? encrypt(upiId) : upiId

    const withdrawal = await tx.referralWithdrawal.create({
      data: { userId, amount, upiId: encryptedUpiId, status, autoApproved },
    })

    if (autoApproved) {
      await tx.user.update({
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
  })
}

export async function listWithdrawals(
  userId: string,
  page = 1,
  limit = 10
): Promise<WithdrawalListResult> {
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
    items: rows.map((w) => {
      // Decrypt UPI ID if encrypted, then mask for display
      let rawUpi = w.upiId
      try {
        if (process.env.ENCRYPTION_KEY && rawUpi.includes(':')) {
          rawUpi = decrypt(rawUpi)
        }
      } catch { /* not encrypted — use as-is */ }

      return {
        id: w.id,
        amount: Number(w.amount),
        // Mask UPI ID: show first 3 + last 4 chars
        upiId: rawUpi.length > 7
          ? `${rawUpi.slice(0, 3)}****${rawUpi.slice(-4)}`
          : '****',
        status: w.status,
        requestedAt: w.createdAt.toISOString(),
        processedAt: w.processedAt?.toISOString() ?? null,
        autoApproved: w.autoApproved,
      }
    }),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}
