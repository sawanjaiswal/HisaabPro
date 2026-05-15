/**
 * Addon Service — grant and revoke feature add-ons for a business.
 *
 * All mutations are tenant-scoped (businessId in WHERE).
 */

import logger from '../../lib/logger.js'
import { prisma } from '../../lib/prisma.js'
import { PLAN_HIERARCHY } from '../../config/plans.js'
import type { SubscriptionPlanTier } from './subscription.types.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GrantAddonInput {
  businessId: string
  addonCode: string
  expiresAt?: Date     // null = indefinite
  razorpaySubId?: string
}

export interface GrantAddonResult {
  businessAddonId: string
  addonCode: string
  startDate: Date
  endDate: Date | null
}

export interface RevokeAddonResult {
  businessAddonId: string
  addonCode: string
  status: 'CANCELLED'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolvePlanTier(businessId: string): Promise<SubscriptionPlanTier> {
  const sub = await prisma.subscription.findUnique({
    where: { businessId },
    select: { planTier: true },
  })
  return (sub?.planTier as SubscriptionPlanTier) ?? 'FREE'
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Grant a feature addon to a business.
 * Validates that the addon exists, is active, and the business has the required plan.
 */
export async function grantAddon(input: GrantAddonInput): Promise<GrantAddonResult> {
  // Look up addon from catalog
  const addon = await prisma.featureAddon.findUnique({
    where: { code: input.addonCode },
    select: { id: true, code: true, isActive: true, requiresPlanTier: true },
  })

  if (!addon || !addon.isActive) {
    throw Object.assign(
      new Error(`Addon '${input.addonCode}' not found or inactive`),
      { code: 'NOT_FOUND', httpStatus: 404 },
    )
  }

  // Check plan requirement
  if (addon.requiresPlanTier) {
    const currentTier = await resolvePlanTier(input.businessId)
    const requiredRank = PLAN_HIERARCHY[addon.requiresPlanTier as keyof typeof PLAN_HIERARCHY] ?? 0
    const currentRank = PLAN_HIERARCHY[currentTier as keyof typeof PLAN_HIERARCHY] ?? 0
    if (currentRank < requiredRank) {
      throw Object.assign(
        new Error(`Addon requires ${addon.requiresPlanTier} plan or higher`),
        { code: 'UPGRADE_REQUIRED', httpStatus: 402 },
      )
    }
  }

  // Check if already active (avoid duplicate)
  const existing = await prisma.businessAddon.findFirst({
    where: {
      businessId: input.businessId,
      featureAddonId: addon.id,
      status: 'ACTIVE',
      OR: [
        { endDate: null },
        { endDate: { gt: new Date() } },
      ],
    },
    select: { id: true },
  })

  if (existing) {
    throw Object.assign(
      new Error(`Addon '${input.addonCode}' is already active`),
      { code: 'CONFLICT', httpStatus: 409 },
    )
  }

  const startDate = new Date()
  const businessAddon = await prisma.businessAddon.create({
    data: {
      businessId: input.businessId,
      featureAddonId: addon.id,
      startDate,
      endDate: input.expiresAt ?? null,
      status: 'ACTIVE',
      razorpaySubId: input.razorpaySubId ?? null,
    },
    select: { id: true },
  })

  logger.info('addon.granted', {
    businessId: input.businessId,
    addonCode: input.addonCode,
    businessAddonId: businessAddon.id,
    expiresAt: input.expiresAt?.toISOString() ?? null,
  })

  return {
    businessAddonId: businessAddon.id,
    addonCode: addon.code,
    startDate,
    endDate: input.expiresAt ?? null,
  }
}

/**
 * Revoke a feature addon from a business.
 */
export async function revokeAddon(
  businessId: string,
  addonCode: string,
): Promise<RevokeAddonResult> {
  const addon = await prisma.featureAddon.findUnique({
    where: { code: addonCode },
    select: { id: true },
  })

  if (!addon) {
    throw Object.assign(new Error(`Addon '${addonCode}' not found`), { code: 'NOT_FOUND', httpStatus: 404 })
  }

  // Find active addon (tenant-scoped)
  const businessAddon = await prisma.businessAddon.findFirst({
    where: {
      businessId,
      featureAddonId: addon.id,
      status: 'ACTIVE',
    },
    select: { id: true },
  })

  if (!businessAddon) {
    throw Object.assign(new Error('Active addon not found'), { code: 'NOT_FOUND', httpStatus: 404 })
  }

  await prisma.businessAddon.update({
    where: { id: businessAddon.id, businessId },
    data: { status: 'CANCELLED', endDate: new Date() },
  })

  logger.info('addon.revoked', { businessId, addonCode, businessAddonId: businessAddon.id })

  return { businessAddonId: businessAddon.id, addonCode, status: 'CANCELLED' }
}
