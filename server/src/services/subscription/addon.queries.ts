/**
 * Addon Queries — read-only side of the addon service.
 * Separated from addon.service.ts to keep write/read responsibilities clean.
 */

import { prisma } from '../../lib/prisma.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActiveAddon {
  id: string
  featureAddonId: string
  code: string
  displayName: string
  status: string
  startDate: Date
  endDate: Date | null
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Get all active addons for a business.
 * Tenant-scoped (businessId in WHERE).
 */
export async function getActiveAddons(businessId: string): Promise<ActiveAddon[]> {
  const rows = await prisma.businessAddon.findMany({
    where: {
      businessId,
      status: 'ACTIVE',
      OR: [
        { endDate: null },
        { endDate: { gt: new Date() } },
      ],
    },
    select: {
      id: true,
      featureAddonId: true,
      status: true,
      startDate: true,
      endDate: true,
      featureAddon: {
        select: { code: true, displayName: true },
      },
    },
    orderBy: { startDate: 'asc' },
  })

  return rows.map((r) => ({
    id: r.id,
    featureAddonId: r.featureAddonId,
    code: r.featureAddon.code,
    displayName: r.featureAddon.displayName,
    status: r.status,
    startDate: r.startDate,
    endDate: r.endDate,
  }))
}

/**
 * Get addon codes for a business (fast — codes only for JWT claims).
 */
export async function getActiveAddonCodes(businessId: string): Promise<string[]> {
  const rows = await prisma.businessAddon.findMany({
    where: {
      businessId,
      status: 'ACTIVE',
      OR: [
        { endDate: null },
        { endDate: { gt: new Date() } },
      ],
    },
    select: { featureAddon: { select: { code: true } } },
  })

  return rows.map((r) => r.featureAddon.code)
}

/**
 * Check if a specific addon is active for a business.
 */
export async function isAddonActive(businessId: string, addonCode: string): Promise<boolean> {
  const count = await prisma.businessAddon.count({
    where: {
      businessId,
      status: 'ACTIVE',
      featureAddon: { code: addonCode },
      OR: [
        { endDate: null },
        { endDate: { gt: new Date() } },
      ],
    },
  })
  return count > 0
}

/**
 * Get all available feature addons from the catalog.
 */
export async function getAddonCatalog() {
  return prisma.featureAddon.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      displayName: true,
      description: true,
      priceMonthlyPaise: true,
      priceYearlyPaise: true,
      requiresPlanTier: true,
    },
    orderBy: { displayName: 'asc' },
  })
}
