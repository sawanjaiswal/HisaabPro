/**
 * Referral code generation, lookup, and resolution.
 */

import crypto from 'crypto'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import type { ReferralCode } from '@prisma/client'

const APP_URL = process.env.FRONTEND_URL ?? 'https://app.hisaabpro.in'
const MAX_CODE_RETRIES = 3

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// ── Public API ───────────────────────────────────────────────────────────────

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
): Promise<(ReferralCode & { user: { id: string; name: string | null } }) | null> {
  return prisma.referralCode.findFirst({
    where: { code: { equals: code, mode: 'insensitive' } },
    include: { user: { select: { id: true, name: true } } },
  })
}
