/**
 * Predefined unit catalogue + shared DB helpers
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'

export const PREDEFINED_UNITS: {
  name: string
  symbol: string
  category: string
  decimalAllowed: boolean
}[] = [
  { name: 'pieces',     symbol: 'pcs',  category: 'COUNT',     decimalAllowed: false },
  { name: 'kilogram',   symbol: 'kg',   category: 'WEIGHT',    decimalAllowed: true  },
  { name: 'gram',       symbol: 'gm',   category: 'WEIGHT',    decimalAllowed: true  },
  { name: 'litre',      symbol: 'ltr',  category: 'VOLUME',    decimalAllowed: true  },
  { name: 'millilitre', symbol: 'ml',   category: 'VOLUME',    decimalAllowed: true  },
  { name: 'box',        symbol: 'box',  category: 'PACKAGING', decimalAllowed: false },
  { name: 'dozen',      symbol: 'dz',   category: 'COUNT',     decimalAllowed: false },
  { name: 'meter',      symbol: 'm',    category: 'LENGTH',    decimalAllowed: true  },
  { name: 'centimeter', symbol: 'cm',   category: 'LENGTH',    decimalAllowed: true  },
  { name: 'feet',       symbol: 'ft',   category: 'LENGTH',    decimalAllowed: true  },
  { name: 'inch',       symbol: 'in',   category: 'LENGTH',    decimalAllowed: true  },
  { name: 'pair',       symbol: 'pr',   category: 'COUNT',     decimalAllowed: false },
  { name: 'set',        symbol: 'set',  category: 'COUNT',     decimalAllowed: false },
  { name: 'bundle',     symbol: 'bdl',  category: 'PACKAGING', decimalAllowed: false },
  { name: 'roll',       symbol: 'roll', category: 'PACKAGING', decimalAllowed: false },
  { name: 'bag',        symbol: 'bag',  category: 'PACKAGING', decimalAllowed: false },
  { name: 'packet',     symbol: 'pkt',  category: 'PACKAGING', decimalAllowed: false },
  { name: 'bottle',     symbol: 'btl',  category: 'PACKAGING', decimalAllowed: false },
  { name: 'can',        symbol: 'can',  category: 'PACKAGING', decimalAllowed: false },
]

/** Seed predefined units for a business if none exist */
export async function ensurePredefinedUnits(businessId: string): Promise<void> {
  const count = await prisma.unit.count({ where: { businessId } })
  if (count > 0) return

  await prisma.unit.createMany({
    data: PREDEFINED_UNITS.map((u) => ({
      businessId,
      name: u.name,
      symbol: u.symbol,
      type: 'PREDEFINED',
      category: u.category,
      decimalAllowed: u.decimalAllowed,
    })),
    skipDuplicates: true,
  })
}

/** Verify unit belongs to business and return it */
export async function requireUnit(businessId: string, unitId: string) {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, businessId },
  })
  if (!unit) throw notFoundError('Unit')
  return unit
}
