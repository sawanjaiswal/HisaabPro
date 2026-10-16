import { HisaabDatabase, db as defaultDb } from '../db/schema';
import { resolveCurrentBusinessId } from './repository.utils';
import type { HomeDashboardData, RecentActivityItem } from '../features/dashboard/dashboard.types';

export class DashboardRepository {
  constructor(
    private db: HisaabDatabase = defaultDb,
    private businessId: string = resolveCurrentBusinessId()
  ) {}

  /**
   * 0ms Local-First Read: Aggregates dashboard metrics instantly from Dexie
   */
  async getHomeData(): Promise<HomeDashboardData> {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [allParties, allDocs, allPayments, allProducts] = await Promise.all([
      this.db.parties.where('businessId').equals(this.businessId).toArray(),
      this.db.documents.where('businessId').equals(this.businessId).toArray(),
      this.db.payments.where('businessId').equals(this.businessId).toArray(),
      this.db.products.where('businessId').equals(this.businessId).toArray(),
    ]);

    const parties = allParties.filter((p) => !p.isDeleted);
    const documents = allDocs.filter((d) => !d.isDeleted);
    const payments = allPayments.filter((p) => !p.isDeleted);
    const products = allProducts.filter((p) => !p.isDeleted);

    // 1. Outstanding receivable and payable
    let recTotal = 0, recCount = 0, payTotal = 0, payCount = 0;
    for (const p of parties) {
      const bal = p.outstandingBalance || 0;
      if (bal > 0) {
        recTotal += bal;
        recCount++;
      } else if (bal < 0) {
        payTotal += Math.abs(bal);
        payCount++;
      }
    }

    // 2. Today's stats
    let salesCount = 0, salesAmount = 0;
    let payInCount = 0, payInAmount = 0, payOutAmount = 0;

    for (const d of documents) {
      if (d.type === 'SALE_INVOICE' && d.status !== 'DRAFT') {
        const dDate = (d.documentDate || '').slice(0, 10);
        if (dDate === todayStr) {
          salesCount++;
          salesAmount += d.grandTotal || 0;
        }
      }
    }

    for (const p of payments) {
      const pDate = (p.date || '').slice(0, 10);
      if (pDate === todayStr) {
        if (p.type === 'PAYMENT_IN' || (p.type as string) === 'IN') {
          payInCount++;
          payInAmount += p.amount || 0;
        } else {
          payOutAmount += p.amount || 0;
        }
      }
    }

    // 3. Alerts: low stock & overdue invoices
    let lowStockCount = 0;
    for (const prod of products) {
      if ((prod.minStockLevel || 0) > 0 && prod.currentStock <= prod.minStockLevel) {
        lowStockCount++;
      }
    }

    let overdueCount = 0, overdueAmount = 0;
    for (const d of documents) {
      if (d.type === 'SALE_INVOICE' && (d.balanceAmount || 0) > 0 && d.dueDate) {
        const due = new Date(d.dueDate);
        if (due < todayStart) {
          overdueCount++;
          overdueAmount += d.balanceAmount || 0;
        }
      }
    }

    // 4. Recent activity (last 10 items)
    const partyNameMap = new Map<string, string>();
    for (const p of parties) partyNameMap.set(p.id, p.name);

    const docActivities: RecentActivityItem[] = documents
      .filter((d) => d.type === 'SALE_INVOICE' || d.type === 'PURCHASE_INVOICE')
      .map((d) => ({
        id: d.id,
        type: d.type === 'SALE_INVOICE' ? ('sale_invoice' as const) : ('purchase_invoice' as const),
        partyId: d.partyId,
        partyName: d.partyName || partyNameMap.get(d.partyId) || 'Customer',
        amount: d.grandTotal || 0,
        date: d.documentDate,
        reference: d.documentNumber || '',
        status: (d.balanceAmount || 0) <= 0 && (d.paidAmount || 0) > 0
          ? ('paid' as const)
          : (d.paidAmount || 0) > 0
          ? ('partial' as const)
          : ('unpaid' as const),
      }));

    const payActivities: RecentActivityItem[] = payments.map((p) => ({
      id: p.id,
      type: p.type === 'PAYMENT_IN' || (p.type as string) === 'IN' ? ('payment_in' as const) : ('payment_out' as const),
      partyId: p.partyId,
      partyName: p.partyName || partyNameMap.get(p.partyId) || 'Party',
      amount: p.amount || 0,
      date: p.date,
      reference: p.paymentNumber || p.referenceNumber || 'Payment',
      mode: p.mode,
    }));

    const recentActivity = [...docActivities, ...payActivities]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 10);

    // 5. Top debtors
    const debtors = parties
      .filter((p) => (p.outstandingBalance || 0) > 0)
      .sort((a, b) => (b.outstandingBalance || 0) - (a.outstandingBalance || 0))
      .slice(0, 5)
      .map((p) => {
        const partyDocs = documents
          .filter((d) => d.partyId === p.id && (d.balanceAmount || 0) > 0)
          .sort((a, b) => (a.dueDate || a.documentDate || '').localeCompare(b.dueDate || b.documentDate || ''));
        const oldest = partyDocs[0];
        const dueDate = oldest?.dueDate || oldest?.documentDate || '';
        const daysOverdue = dueDate
          ? Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000))
          : 0;
        return {
          partyId: p.id,
          name: p.name,
          phone: p.phone || '',
          outstanding: p.outstandingBalance || 0,
          oldestDueDate: dueDate ? dueDate.slice(0, 10) : '',
          daysOverdue,
        };
      });

    // 6. Trend structure (30 days)
    const trendDays = 30;
    const salesSeries = new Array(trendDays).fill(0);
    const colSeries = new Array(trendDays).fill(0);
    const expSeries = new Array(trendDays).fill(0);

    let total30dSales = 0, total30dCol = 0, total30dExp = 0;
    for (const d of documents) {
      if (d.type === 'SALE_INVOICE' && d.status !== 'DRAFT') {
        const dayIdx = Math.floor((Date.now() - new Date(d.documentDate).getTime()) / 86_400_000);
        if (dayIdx >= 0 && dayIdx < trendDays) {
          salesSeries[trendDays - 1 - dayIdx] += d.grandTotal || 0;
          total30dSales += d.grandTotal || 0;
        }
      }
    }
    for (const p of payments) {
      const isCol = p.type === 'PAYMENT_IN' || (p.type as string) === 'IN';
      const dayIdx = Math.floor((Date.now() - new Date(p.date).getTime()) / 86_400_000);
      if (dayIdx >= 0 && dayIdx < trendDays) {
        if (isCol) {
          colSeries[trendDays - 1 - dayIdx] += p.amount || 0;
          total30dCol += p.amount || 0;
        } else {
          expSeries[trendDays - 1 - dayIdx] += p.amount || 0;
          total30dExp += p.amount || 0;
        }
      }
    }

    return {
      outstanding: {
        receivable: { total: recTotal, partyCount: recCount },
        payable: { total: payTotal, partyCount: payCount },
      },
      today: {
        salesCount,
        salesAmount,
        paymentsReceivedCount: payInCount,
        paymentsReceivedAmount: payInAmount,
        paymentsMadeAmount: payOutAmount,
        netCashFlow: payInAmount - payOutAmount,
      },
      recentActivity,
      trend: {
        days: trendDays,
        sales: { total: total30dSales, previousTotal: 0, deltaPct: null, series: salesSeries },
        collections: { total: total30dCol, previousTotal: 0, deltaPct: null, series: colSeries },
        expenses: { total: total30dExp, previousTotal: 0, deltaPct: null, series: expSeries },
        cashInHand: Math.max(0, total30dCol - total30dExp),
        todayVsYesterday: { today: salesAmount, yesterday: 0, deltaPct: null },
      },
      alerts: {
        lowStockCount,
        overdueInvoiceCount: overdueCount,
        overdueAmount,
      },
      topDebtors: debtors,
    };
  }
}
