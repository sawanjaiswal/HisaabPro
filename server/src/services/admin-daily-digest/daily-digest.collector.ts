import { prisma } from '../../lib/prisma.js';
import type { HisaabProDailyDigestMetrics } from './daily-digest.types.js';

export async function collectDailyDigestMetrics(
  targetDateStr: string,
  startUtc: Date,
  endUtc: Date
): Promise<HisaabProDailyDigestMetrics> {
  const [
    newUsers,
    newBusinesses,
    totalUsers,
    totalBusinesses,
    invoicesToday,
    paymentsToday,
    activeSubscriptions,
    proSubs,
    enterpriseSubs,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        createdAt: { gte: startUtc, lte: endUtc },
      },
    }).catch(() => 0),

    prisma.business.count({
      where: {
        createdAt: { gte: startUtc, lte: endUtc },
      },
    }).catch(() => 0),

    prisma.user.count().catch(() => 0),
    prisma.business.count().catch(() => 0),

    prisma.document.findMany({
      where: {
        type: 'SALE_INVOICE',
        status: { in: ['SAVED', 'SHARED', 'CONVERTED'] },
        createdAt: { gte: startUtc, lte: endUtc },
      },
      select: {
        grandTotal: true,
      },
      take: 5000,
    }).catch(() => []),

    prisma.payment.findMany({
      where: {
        type: 'PAYMENT_IN',
        isDeleted: false,
        createdAt: { gte: startUtc, lte: endUtc },
      },
      select: {
        amount: true,
      },
      take: 5000,
    }).catch(() => []),

    prisma.subscription.count({
      where: {
        status: 'ACTIVE',
      },
    }).catch(() => 0),

    prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        planTier: 'PRO',
      },
    }).catch(() => 0),

    prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        planTier: 'ENTERPRISE',
      },
    }).catch(() => 0),
  ]);

  const totalSalesPaise = invoicesToday.reduce((acc, inv) => acc + Number(inv.grandTotal || 0), 0);
  const totalCollectionsPaise = paymentsToday.reduce((acc, p) => acc + Number(p.amount || 0), 0);

  return {
    targetDateStr,
    registrations: {
      newUsers,
      newBusinesses,
      totalUsers,
      totalBusinesses,
    },
    salesAndInvoices: {
      invoicesCreatedToday: invoicesToday.length,
      totalSalesPaise,
    },
    collections: {
      paymentsReceivedCount: paymentsToday.length,
      totalCollectionsPaise,
    },
    subscriptions: {
      activeSubscriptions,
      proPlanCount: proSubs,
      enterprisePlanCount: enterpriseSubs,
    },
  };
}
