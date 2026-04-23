/**
 * Fraud detection: self-referral guard, double-apply guard.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { resolveCode } from './code.js'

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
