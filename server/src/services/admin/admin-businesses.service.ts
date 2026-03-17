/**
 * Admin Business Management Service
 * Paginated listing, detail view
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'

// --------------------------------------------------------------------------
// List businesses — cursor-based pagination
// --------------------------------------------------------------------------

export async function getAllBusinesses(filters: {
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
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ]
  }

  if (status === 'active') {
    where['isActive'] = true
  } else if (status === 'inactive') {
    where['isActive'] = false
  }

  const businesses = await prisma.business.findMany({
    where,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      businessType: true,
      city: true,
      state: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          businessUsers: true,
          parties: true,
          documents: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  let nextCursor: string | null = null
  if (businesses.length > take) {
    const last = businesses.pop()!
    nextCursor = last.id
  }

  return { businesses, nextCursor }
}

// --------------------------------------------------------------------------
// Business detail
// --------------------------------------------------------------------------

export async function getBusinessDetails(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      businessType: true,
      currencyCode: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          businessUsers: true,
          parties: true,
          products: true,
          documents: true,
          payments: true,
        },
      },
    },
  })

  if (!business) throw notFoundError('Business')

  // Financial summary
  const [docStats, paymentStats, members] = await Promise.all([
    prisma.document.aggregate({
      where: {
        businessId,
        status: { notIn: ['DELETED'] },
        type: 'SALE_INVOICE',
      },
      _count: true,
      _sum: { grandTotal: true, totalProfit: true },
    }),
    prisma.payment.aggregate({
      where: { businessId, isDeleted: false, type: 'PAYMENT_IN' },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.businessUser.findMany({
      where: { businessId },
      select: {
        role: true,
        isActive: true,
        joinedAt: true,
        user: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
    }),
  ])

  return {
    business,
    stats: {
      totalSaleInvoices: docStats._count,
      totalSaleValue: docStats._sum.grandTotal ?? 0,
      totalProfit: docStats._sum.totalProfit ?? 0,
      totalPaymentsIn: paymentStats._count,
      totalPaymentValue: paymentStats._sum.amount ?? 0,
    },
    members,
  }
}
