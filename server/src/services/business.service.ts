/**
 * Business Service
 * Creates a business with owner record and seeds default categories.
 * Uses a transaction so everything succeeds or nothing does.
 */

import { prisma } from '../lib/prisma.js'
import { conflictError } from '../lib/errors.js'
import logger from '../lib/logger.js'
import type { CreateBusinessInput } from '../schemas/business.schemas.js'

// Default categories seeded for every new business
const DEFAULT_CATEGORIES = [
  { name: 'General',        color: '#6B7280', sortOrder: 0 },
  { name: 'Electronics',    color: '#3B82F6', sortOrder: 1 },
  { name: 'Grocery',        color: '#22C55E', sortOrder: 2 },
  { name: 'Clothing',       color: '#A855F7', sortOrder: 3 },
  { name: 'Hardware',       color: '#F97316', sortOrder: 4 },
  { name: 'Stationery',     color: '#EAB308', sortOrder: 5 },
  { name: 'Food & Beverage', color: '#EF4444', sortOrder: 6 },
  { name: 'Health & Beauty', color: '#EC4899', sortOrder: 7 },
  { name: 'Auto Parts',     color: '#6366F1', sortOrder: 8 },
  { name: 'Other',          color: '#94A3B8', sortOrder: 9 },
]

export async function createBusiness(userId: string, data: CreateBusinessInput) {
  logger.info('Creating business', { userId, businessName: data.name })

  // Guard: prevent a user from creating a second business (MVP constraint)
  const existing = await prisma.businessUser.findFirst({
    where: { userId, isActive: true },
    select: { businessId: true },
  })
  if (existing) {
    throw conflictError('You already have an active business')
  }

  const business = await prisma.$transaction(async (tx) => {
    // 1. Create the business
    const created = await tx.business.create({
      data: {
        name: data.name,
        businessType: data.businessType ?? 'general',
        phone: data.phone,
        email: data.email,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        logoUrl: true,
        businessType: true,
        currencyCode: true,
        financialYearStart: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // 2. Create BusinessUser record (owner role)
    await tx.businessUser.create({
      data: {
        userId,
        businessId: created.id,
        role: 'owner',
        isActive: true,
        status: 'ACTIVE',
      },
    })

    // 3. Seed default categories
    await tx.category.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({
        businessId: created.id,
        name: cat.name,
        type: 'PREDEFINED',
        color: cat.color,
        sortOrder: cat.sortOrder,
      })),
    })

    return created
  })

  logger.info('Business created', { businessId: business.id, userId })
  return business
}
