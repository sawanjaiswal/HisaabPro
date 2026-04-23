/**
 * Seed factories — create real DB records for integration tests.
 * All functions use prisma.create with unique suffixes to avoid conflicts.
 */

import crypto from 'node:crypto'
import { prisma } from '../../lib/prisma.js'

const uid = () => crypto.randomUUID().slice(0, 8)

// ─── User ────────────────────────────────────────────────────────────────────

export async function createTestUser(overrides?: Record<string, unknown>) {
  return prisma.user.create({
    data: {
      phone: `98${Date.now().toString().slice(-8)}`,
      name: `TestUser-${uid()}`,
      isActive: true,
      isSuspended: false,
      ...overrides,
    },
  })
}

// ─── Business ────────────────────────────────────────────────────────────────

export async function createTestBusiness(
  _userId: string,
  overrides?: Record<string, unknown>
) {
  return prisma.business.create({
    data: {
      name: `TestBiz-${uid()}`,
      businessType: 'general',
      ...overrides,
    },
  })
}

// ─── BusinessUser ────────────────────────────────────────────────────────────

export async function createTestBusinessUser(
  userId: string,
  businessId: string,
  role = 'owner',
  roleId?: string
) {
  return prisma.businessUser.create({
    data: {
      userId,
      businessId,
      role,
      roleId: roleId ?? null,
      isActive: true,
      status: 'ACTIVE',
    },
  })
}

// ─── Role ────────────────────────────────────────────────────────────────────

export async function createTestRole(
  businessId: string,
  overrides?: Record<string, unknown>
) {
  return prisma.role.create({
    data: {
      businessId,
      name: `role-${uid()}`,
      isSystem: false,
      permissions: [],
      ...overrides,
    },
  })
}

// ─── Party ───────────────────────────────────────────────────────────────────

export async function createTestParty(
  businessId: string,
  overrides?: Record<string, unknown>
) {
  return prisma.party.create({
    data: {
      businessId,
      name: `Party-${uid()}`,
      type: 'CUSTOMER',
      isActive: true,
      ...overrides,
    },
  })
}

// ─── Unit ────────────────────────────────────────────────────────────────────

export async function createTestUnit(
  businessId: string,
  overrides?: Record<string, unknown>
) {
  return prisma.unit.create({
    data: {
      businessId,
      name: `Unit-${uid()}`,
      symbol: `u${uid().slice(0, 3)}`,
      type: 'CUSTOM',
      category: 'COUNT',
      ...overrides,
    },
  })
}

// ─── Category ────────────────────────────────────────────────────────────────

export async function createTestCategory(
  businessId: string,
  overrides?: Record<string, unknown>
) {
  return prisma.category.create({
    data: {
      businessId,
      name: `Cat-${uid()}`,
      ...overrides,
    },
  })
}

// ─── Product ─────────────────────────────────────────────────────────────────

export async function createTestProduct(
  businessId: string,
  unitId: string,
  overrides?: Record<string, unknown>
) {
  return prisma.product.create({
    data: {
      businessId,
      unitId,
      name: `Prod-${uid()}`,
      salePrice: 10000, // Rs 100
      purchasePrice: 7000, // Rs 70
      currentStock: 100,
      status: 'ACTIVE',
      ...overrides,
    },
  })
}

// ─── Full Setup ──────────────────────────────────────────────────────────────

/**
 * Creates a complete test environment:
 * user + business + businessUser(owner) + party + unit + category + product
 */
export async function seedFullSetup() {
  const user = await createTestUser()
  const business = await createTestBusiness(user.id)
  const businessUser = await createTestBusinessUser(
    user.id,
    business.id,
    'owner'
  )
  const party = await createTestParty(business.id)
  const unit = await createTestUnit(business.id)
  const category = await createTestCategory(business.id)
  const product = await createTestProduct(business.id, unit.id, {
    categoryId: category.id,
  })

  return { user, business, businessUser, party, unit, category, product }
}
