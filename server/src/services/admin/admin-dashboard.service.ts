/**
 * Admin Dashboard Service
 * Platform-wide statistics and growth metrics
 */

import { prisma } from '../../lib/prisma.js'

// --------------------------------------------------------------------------
// Platform overview
// --------------------------------------------------------------------------

export async function getPlatformOverview() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    activeUsersLast30d,
    suspendedUsers,
    newUsersLast7d,
    totalBusinesses,
    activeBusinesses,
    newBusinessesLast7d,
    totalDocuments,
    documentsLast30d,
    totalPayments,
    paymentStats,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: { isSuspended: false, isActive: true },
    }),
    prisma.user.count({ where: { isSuspended: true } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.business.count(),
    prisma.business.count({ where: { isActive: true } }),
    prisma.business.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.document.count({ where: { status: { not: 'DELETED' } } }),
    prisma.document.count({
      where: { createdAt: { gte: thirtyDaysAgo }, status: { not: 'DELETED' } },
    }),
    prisma.payment.count({ where: { isDeleted: false } }),
    prisma.payment.aggregate({
      where: { isDeleted: false, type: 'PAYMENT_IN' },
      _sum: { amount: true },
    }),
  ])

  return {
    users: {
      total: totalUsers,
      active: activeUsersLast30d,
      suspended: suspendedUsers,
      newLast7d: newUsersLast7d,
    },
    businesses: {
      total: totalBusinesses,
      active: activeBusinesses,
      newLast7d: newBusinessesLast7d,
    },
    documents: {
      total: totalDocuments,
      last30d: documentsLast30d,
    },
    payments: {
      total: totalPayments,
      totalValuePaise: paymentStats._sum.amount ?? 0,
    },
  }
}

// --------------------------------------------------------------------------
// Growth metrics (signups chart)
// --------------------------------------------------------------------------

export async function getGrowthMetrics(period: '7' | '30' | '90' = '30') {
  const days = parseInt(period, 10)
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [newUsers, newBusinesses, documentsByDay] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: startDate } } }),
    prisma.business.count({ where: { createdAt: { gte: startDate } } }),
    // Group documents by day for chart data — use DB-level groupBy
    prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT DATE("createdAt")::text AS date, COUNT(*)::bigint AS count
      FROM "Document"
      WHERE "createdAt" >= ${startDate}
        AND status != 'DELETED'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,
  ])

  return {
    period: `${days}d`,
    newUsers,
    newBusinesses,
    dailyDocuments: documentsByDay.map((row) => ({
      date: row.date,
      count: Number(row.count),
    })),
  }
}
