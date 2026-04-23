import { prisma } from '../../lib/prisma.js'
import { generateTokens } from '../../lib/jwt.js'
import { unauthorizedError } from '../../lib/errors.js'

/**
 * Get current user profile with businesses and active business details.
 */
export async function getMe(userId: string, activeBusinessId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
      lastActiveBusinessId: true,
      businessUsers: {
        where: { isActive: true, status: 'ACTIVE' },
        select: {
          role: true,
          status: true,
          lastActiveAt: true,
          roleRef: { select: { id: true, name: true } },
          business: { select: { id: true, name: true, businessType: true } },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  })

  if (!user) return null

  const businesses = user.businessUsers.map(bu => ({
    id: bu.business.id,
    name: bu.business.name,
    businessType: bu.business.businessType,
    role: bu.role,
    roleId: bu.roleRef?.id ?? null,
    roleName: bu.roleRef?.name ?? bu.role,
    status: bu.status,
    lastActiveAt: bu.lastActiveAt,
  }))

  const currentBizId = activeBusinessId || user.lastActiveBusinessId
  const activeBusiness = businesses.find(b => b.id === currentBizId) ?? businesses[0] ?? null

  return {
    user: { id: user.id, phone: user.phone, name: user.name },
    businesses,
    activeBusiness,
  }
}

/**
 * Switch the user's active business.
 * Validates membership, generates new JWT, updates lastActiveBusinessId.
 */
export async function switchBusiness(userId: string, phone: string, targetBusinessId: string) {
  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId: targetBusinessId } },
    select: {
      isActive: true,
      status: true,
      business: { select: { id: true, name: true, businessType: true } },
    },
  })

  if (!bu || !bu.isActive || bu.status !== 'ACTIVE') {
    throw unauthorizedError('You do not have access to this business')
  }

  const tokens = generateTokens(userId, phone, targetBusinessId)

  // Update lastActiveBusinessId + lastActiveAt in parallel
  await Promise.all([
    prisma.user.update({
      where: { id: userId },
      data: { lastActiveBusinessId: targetBusinessId },
    }),
    prisma.businessUser.update({
      where: { userId_businessId: { userId, businessId: targetBusinessId } },
      data: { lastActiveAt: new Date() },
    }),
  ])

  return { tokens, business: bu.business }
}

/**
 * List all businesses the user belongs to.
 */
export async function listUserBusinesses(userId: string) {
  const businessUsers = await prisma.businessUser.findMany({
    where: { userId, isActive: true, status: 'ACTIVE' },
    select: {
      role: true,
      status: true,
      lastActiveAt: true,
      roleRef: { select: { id: true, name: true } },
      business: { select: { id: true, name: true, businessType: true } },
    },
    orderBy: { joinedAt: 'asc' },
    take: 50, // bounded: a user typically belongs to < 50 businesses
  })

  return businessUsers.map(bu => ({
    id: bu.business.id,
    name: bu.business.name,
    businessType: bu.business.businessType,
    role: bu.role,
    roleName: bu.roleRef?.name ?? bu.role,
    status: bu.status,
    lastActiveAt: bu.lastActiveAt,
  }))
}
