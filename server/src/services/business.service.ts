/**
 * Business Service
 * Creates a business with owner record and seeds default categories.
 * Uses a transaction so everything succeeds or nothing does.
 */

import { prisma } from '../lib/prisma.js'
import { conflictError, validationError } from '../lib/errors.js'
import logger from '../lib/logger.js'
import { DEFAULT_CATEGORIES } from '../config/defaults.js'
import type { CreateBusinessInput, UpdateBusinessInput } from '../schemas/business.schemas.js'
import { ensureSystemRoles } from './settings.service.js'
import { applyVerticalDefaults } from './verticals/defaults.js'
import { cloneBusinessSettings } from './business-clone.helper.js'

const MAX_BUSINESSES = 10

export async function createBusiness(userId: string, data: CreateBusinessInput) {
  logger.info('Creating business', { userId, businessName: data.name })

  // Guard: max 10 active businesses per user
  const activeCount = await prisma.businessUser.count({
    where: { userId, isActive: true },
  })
  if (activeCount >= MAX_BUSINESSES) {
    throw validationError('You have reached the maximum of 10 businesses')
  }

  // If cloning, verify user owns the source business
  if (data.cloneFromBusinessId) {
    const sourceOwnership = await prisma.businessUser.findFirst({
      where: { userId, businessId: data.cloneFromBusinessId, role: 'owner' },
      select: { id: true },
    })
    if (!sourceOwnership) {
      throw validationError('You do not own the business you are trying to clone from')
    }
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

    // 4. Clone settings from source business (if requested)
    if (data.cloneFromBusinessId) {
      await cloneBusinessSettings(tx, data.cloneFromBusinessId, created.id)
    }

    return created
  })

  // Seed system roles for the new business
  await ensureSystemRoles(business.id)

  // Seed vertical-specific InventorySetting defaults (no-op for 'general' etc.)
  await applyVerticalDefaults(business.id, business.businessType ?? 'general')

  logger.info('Business created', { businessId: business.id, userId })
  return business
}

const BUSINESS_SELECT = {
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
  // Inventory settings (BAT-07)
  expiryAlertDays: true,
  expiredBatchPolicy: true,
  // Epic C PR2
  upiVpa: true,
} as const

export async function getBusiness(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: BUSINESS_SELECT,
  })
  if (!business) throw conflictError('Business not found')
  return business
}

export async function updateBusiness(
  businessId: string,
  data: UpdateBusinessInput
) {
  const business = await prisma.business.update({
    where: { id: businessId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.businessType !== undefined && { businessType: data.businessType }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.state !== undefined && { state: data.state }),
      ...(data.pincode !== undefined && { pincode: data.pincode }),
      // Inventory settings (BAT-07)
      ...(data.expiryAlertDays !== undefined && { expiryAlertDays: data.expiryAlertDays }),
      ...(data.expiredBatchPolicy !== undefined && { expiredBatchPolicy: data.expiredBatchPolicy }),
      // Epic C PR2 — UPI VPA (null = clear the field)
      ...(data.upiVpa !== undefined && { upiVpa: data.upiVpa }),
    },
    select: BUSINESS_SELECT,
  })
  return business
}
