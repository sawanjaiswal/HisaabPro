/** Admin User Management Service — listing, details, suspension */
import { prisma } from '../../lib/prisma.js'
import { sanitizeText } from '../../lib/sanitize.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { blacklistUser } from '../../lib/token-blacklist.js'

export async function getAllUsers(filters: {
  cursor?: string
  limit?: number
  search?: string
  status?: string
}) {
  const { cursor, limit = 20, search = '', status = 'all' } = filters
  const take = Math.min(limit, 100)

  const where: Record<string, unknown> = {}

  if (search) {
    where['OR'] = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (status === 'active') {
    where['lastLoginAt'] = { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    where['isSuspended'] = false
  } else if (status === 'inactive') {
    where['OR'] = [
      { lastLoginAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      { lastLoginAt: null },
    ]
    where['isSuspended'] = false
  } else if (status === 'suspended') {
    where['isSuspended'] = true
  }

  const users = await prisma.user.findMany({
    where,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      isActive: true,
      isSuspended: true,
      suspendedAt: true,
      suspendedReason: true,
      createdAt: true,
      _count: {
        select: {
          businessUsers: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  let nextCursor: string | null = null
  if (users.length > take) {
    const last = users.pop()!
    nextCursor = last.id
  }

  return { users, nextCursor }
}

export async function getUserDetails(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      isActive: true,
      isSuspended: true,
      suspendedAt: true,
      suspendedReason: true,
      failedLoginAttempts: true,
      accountLockedUntil: true,
      lastFailedLoginAt: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          businessUsers: true,
          auditLogs: true,
        },
      },
    },
  })

  if (!user) throw notFoundError('User')

  const [documentStats, paymentStats, businesses] = await Promise.all([
    prisma.document.aggregate({
      where: { createdBy: userId, status: { not: 'DELETED' } },
      _count: true,
      _sum: { grandTotal: true },
    }),
    prisma.payment.aggregate({
      where: { createdBy: userId, isDeleted: false },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.businessUser.findMany({
      where: { userId },
      select: {
        role: true,
        isActive: true,
        joinedAt: true,
        business: {
          select: { id: true, name: true, businessType: true, isActive: true },
        },
      },
    }),
  ])

  return {
    user,
    stats: {
      totalDocuments: documentStats._count,
      totalDocumentValue: documentStats._sum.grandTotal ?? 0,
      totalPayments: paymentStats._count,
      totalPaymentValue: paymentStats._sum.amount ?? 0,
    },
    businesses,
  }
}

export async function suspendUser(
  userId: string,
  adminId: string,
  data: { reason: string; notes?: string }
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isSuspended: true },
  })

  if (!user) throw notFoundError('User')
  if (user.isSuspended) throw validationError('User is already suspended')

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isSuspended: true,
      suspendedAt: new Date(),
      suspendedReason: sanitizeText(data.reason),
    },
    select: { id: true, name: true, phone: true, isSuspended: true, suspendedAt: true },
  })

  await prisma.userSuspension.upsert({
    where: { userId },
    create: {
      userId,
      suspendedBy: adminId,
      reason: sanitizeText(data.reason),
      notes: data.notes ? sanitizeText(data.notes) : null,
    },
    update: {
      suspendedBy: adminId,
      reason: sanitizeText(data.reason),
      notes: data.notes ? sanitizeText(data.notes) : null,
      suspendedAt: new Date(),
      liftedAt: null,
      liftedBy: null,
      liftNotes: null,
    },
  })

  blacklistUser(userId)
  return updated
}

export async function unsuspendUser(
  userId: string,
  adminId: string,
  notes?: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isSuspended: true },
  })

  if (!user) throw notFoundError('User')
  if (!user.isSuspended) throw validationError('User is not suspended')

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isSuspended: false,
      suspendedAt: null,
      suspendedReason: null,
    },
    select: { id: true, name: true, phone: true, isSuspended: true },
  })

  await prisma.userSuspension.updateMany({
    where: { userId, liftedAt: null },
    data: {
      liftedAt: new Date(),
      liftedBy: adminId,
      liftNotes: notes ? sanitizeText(notes) : null,
    },
  })

  return updated
}

export async function unlockUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })

  if (!user) throw notFoundError('User')

  return prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      lastFailedLoginAt: null,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      failedLoginAttempts: true,
      accountLockedUntil: true,
    },
  })
}
