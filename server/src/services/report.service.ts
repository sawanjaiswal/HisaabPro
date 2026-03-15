/**
 * Report Service — Invoice Report, Party Statement, Stock Summary, Day Book, Payment History
 * All amounts in PAISE. Uses DB aggregates where possible.
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError } from '../lib/errors.js'
import type {
  InvoiceReportQuery,
  PartyStatementQuery,
  StockSummaryQuery,
  DayBookQuery,
  PaymentHistoryQuery,
} from '../schemas/report.schemas.js'

// === Invoice Report ===

export async function getInvoiceReport(businessId: string, query: InvoiceReportQuery) {
  const { type, from, to, partyId, status, groupBy, sortBy, cursor, limit } = query

  const docType = type === 'sale' ? 'SALE_INVOICE' : 'PURCHASE_INVOICE'

  const where: Record<string, unknown> = {
    businessId,
    type: docType,
    status: { in: ['SAVED', 'SHARED'] },
  }
  if (from || to) {
    where.documentDate = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to) }),
    }
  }
  if (partyId) where.partyId = partyId
  if (status === 'paid') where.balanceDue = 0
  if (status === 'unpaid') where.paidAmount = 0
  if (status === 'partial') {
    where.paidAmount = { gt: 0 }
    where.balanceDue = { gt: 0 }
  }
  if (cursor) where.id = { lt: cursor }

  const orderField = sortBy.startsWith('amount') ? 'grandTotal' : 'documentDate'
  const orderDir = sortBy.endsWith('asc') ? 'asc' : 'desc'

  const [items, total, summary] = await Promise.all([
    prisma.document.findMany({
      where,
      select: {
        id: true, documentNumber: true, documentDate: true,
        grandTotal: true, paidAmount: true, balanceDue: true,
        party: { select: { id: true, name: true } },
        _count: { select: { lineItems: true } },
      },
      orderBy: { [orderField]: orderDir },
      take: limit + 1,
    }),
    prisma.document.count({ where }),
    prisma.document.aggregate({
      where,
      _count: true,
      _sum: {
        grandTotal: true,
        paidAmount: true,
        balanceDue: true,
        totalDiscount: true,
      },
    }),
  ])

  const hasMore = items.length > limit
  const resultItems = items.slice(0, limit)

  const mapped = resultItems.map(inv => ({
    id: inv.id,
    number: inv.documentNumber,
    date: inv.documentDate.toISOString(),
    partyId: inv.party.id,
    partyName: inv.party.name,
    itemCount: inv._count.lineItems,
    amount: inv.grandTotal,
    paid: inv.paidAmount,
    balance: inv.balanceDue,
    status: inv.balanceDue === 0 ? 'paid' : inv.paidAmount > 0 ? 'partial' : 'unpaid',
  }))

  return {
    data: {
      summary: {
        totalInvoices: summary._count,
        totalAmount: summary._sum.grandTotal || 0,
        totalPaid: summary._sum.paidAmount || 0,
        totalOutstanding: summary._sum.balanceDue || 0,
        totalDiscount: summary._sum.totalDiscount || 0,
      },
      items: groupBy === 'none' ? mapped : undefined,
      groups: groupBy !== 'none' ? groupItems(mapped, groupBy) : undefined,
    },
    meta: {
      cursor: hasMore ? resultItems[resultItems.length - 1].id : null,
      hasMore,
      total,
    },
  }
}

function groupItems(items: Array<{ date: string; partyName: string; amount: number; paid: number; balance: number }>, groupBy: string) {
  const groups = new Map<string, typeof items>()

  for (const item of items) {
    let key: string
    if (groupBy === 'party') {
      key = item.partyName
    } else if (groupBy === 'month') {
      key = item.date.substring(0, 7) // "YYYY-MM"
    } else if (groupBy === 'day') {
      key = item.date.substring(0, 10) // "YYYY-MM-DD"
    } else {
      key = 'All'
    }
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }

  return Array.from(groups.entries()).map(([key, groupItems]) => ({
    key,
    label: key,
    invoiceCount: groupItems.length,
    totalAmount: groupItems.reduce((s, i) => s + i.amount, 0),
    totalPaid: groupItems.reduce((s, i) => s + i.paid, 0),
    totalOutstanding: groupItems.reduce((s, i) => s + i.balance, 0),
    items: groupItems,
  }))
}

// === Party Statement ===

export async function getPartyStatement(
  businessId: string,
  partyId: string,
  query: PartyStatementQuery
) {
  const party = await prisma.party.findFirst({
    where: { id: partyId, businessId },
    select: {
      id: true, name: true, phone: true, type: true,
      outstandingBalance: true,
      openingBalance: { select: { amount: true, type: true, asOfDate: true } },
    },
  })
  if (!party) throw notFoundError('Party')

  const { from, to, limit } = query

  const dateFilter: Record<string, unknown> = {}
  if (from) dateFilter.gte = new Date(from)
  if (to) dateFilter.lte = new Date(to)
  const hasDateFilter = Object.keys(dateFilter).length > 0

  // Get invoices for this party in range
  const invoices = await prisma.document.findMany({
    where: {
      businessId,
      partyId,
      status: { in: ['SAVED', 'SHARED'] },
      type: { in: ['SALE_INVOICE', 'PURCHASE_INVOICE'] },
      ...(hasDateFilter && { documentDate: dateFilter }),
    },
    select: {
      id: true, type: true, documentNumber: true,
      documentDate: true, grandTotal: true,
    },
    orderBy: { documentDate: 'asc' },
    take: limit,
  })

  // Get payments for this party in range
  const payments = await prisma.payment.findMany({
    where: {
      businessId,
      partyId,
      isDeleted: false,
      ...(hasDateFilter && { date: dateFilter }),
    },
    select: {
      id: true, type: true, amount: true, date: true,
      referenceNumber: true,
    },
    orderBy: { date: 'asc' },
    take: limit,
  })

  // Merge and sort by date
  type Txn = {
    id: string; date: Date; type: string; reference: string;
    referenceId: string; description: string; debit: number; credit: number;
  }
  const transactions: Txn[] = []

  for (const inv of invoices) {
    const isSale = inv.type === 'SALE_INVOICE'
    transactions.push({
      id: inv.id,
      date: inv.documentDate,
      type: isSale ? 'sale_invoice' : 'purchase_invoice',
      reference: inv.documentNumber || '',
      referenceId: inv.id,
      description: `${isSale ? 'Sale' : 'Purchase'} Invoice`,
      debit: isSale ? inv.grandTotal : 0,
      credit: isSale ? 0 : inv.grandTotal,
    })
  }

  for (const pmt of payments) {
    const isIn = pmt.type === 'PAYMENT_IN'
    transactions.push({
      id: pmt.id,
      date: pmt.date,
      type: isIn ? 'payment_received' : 'payment_made',
      reference: pmt.referenceNumber || '',
      referenceId: pmt.id,
      description: `Payment ${isIn ? 'Received' : 'Made'}`,
      debit: isIn ? 0 : pmt.amount,
      credit: isIn ? pmt.amount : 0,
    })
  }

  transactions.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Calculate running balance
  let balance = party.openingBalance?.amount || 0
  if (party.openingBalance?.type === 'PAYABLE') balance = -balance

  const txnsWithBalance = transactions.map(t => {
    balance += t.debit - t.credit
    return {
      ...t,
      date: t.date.toISOString(),
      runningBalance: balance,
    }
  })

  const totalDebit = transactions.reduce((s, t) => s + t.debit, 0)
  const totalCredit = transactions.reduce((s, t) => s + t.credit, 0)

  return {
    data: {
      party: {
        id: party.id,
        name: party.name,
        phone: party.phone,
        type: party.type === 'CUSTOMER' ? 'customer' : 'supplier',
      },
      openingBalance: {
        amount: party.openingBalance?.amount || 0,
        type: (party.openingBalance?.type || 'receivable').toLowerCase(),
        asOfDate: party.openingBalance?.asOfDate?.toISOString() || '',
      },
      closingBalance: {
        amount: Math.abs(balance),
        type: balance >= 0 ? 'receivable' : 'payable',
        asOfDate: new Date().toISOString(),
      },
      transactions: txnsWithBalance,
      totals: { totalDebit, totalCredit },
    },
    meta: {
      cursor: null,
      hasMore: false,
      total: transactions.length,
    },
  }
}

// === Stock Summary ===

export async function getStockSummary(businessId: string, query: StockSummaryQuery) {
  const { categoryId, stockStatus, search, sortBy, limit } = query

  const where: Record<string, unknown> = {
    businessId,
    status: 'ACTIVE',
  }
  if (categoryId) where.categoryId = categoryId
  if (search) where.name = { contains: search, mode: 'insensitive' }

  // Stock status filter
  if (stockStatus === 'out_of_stock') where.currentStock = { lte: 0 }
  // low stock and in_stock need raw SQL for column comparison, handled post-query for simplicity

  const orderField = sortBy.startsWith('name') ? 'name'
    : sortBy.startsWith('stock') ? 'currentStock'
    : 'salePrice'
  const orderDir = sortBy.endsWith('asc') ? 'asc' : 'desc'

  const [products, stats] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true, name: true, currentStock: true, minStockLevel: true,
        purchasePrice: true, salePrice: true,
        category: { select: { name: true } },
        unit: { select: { symbol: true } },
      },
      orderBy: { [orderField]: orderDir },
      take: limit,
    }),
    prisma.product.aggregate({
      where: { businessId, status: 'ACTIVE' },
      _count: true,
    }),
  ])

  // Calculate stock values and status
  let totalStockValueAtPurchase = 0
  let totalStockValueAtSale = 0
  let lowStockCount = 0
  let outOfStockCount = 0

  const items = products.map(p => {
    const purchaseVal = Math.round(p.currentStock * (p.purchasePrice || 0))
    const saleVal = Math.round(p.currentStock * p.salePrice)
    totalStockValueAtPurchase += purchaseVal
    totalStockValueAtSale += saleVal

    let status: 'in_stock' | 'low' | 'out_of_stock'
    if (p.currentStock <= 0) {
      status = 'out_of_stock'
      outOfStockCount++
    } else if (p.currentStock <= p.minStockLevel) {
      status = 'low'
      lowStockCount++
    } else {
      status = 'in_stock'
    }

    return {
      productId: p.id,
      name: p.name,
      category: p.category?.name || 'Uncategorized',
      unit: p.unit.symbol,
      currentStock: p.currentStock,
      minStockLevel: p.minStockLevel,
      purchasePrice: p.purchasePrice || 0,
      salePrice: p.salePrice,
      stockValueAtPurchase: purchaseVal,
      stockValueAtSale: saleVal,
      stockStatus: status,
    }
  }).filter(item => !stockStatus || stockStatus === item.stockStatus)

  return {
    data: {
      summary: {
        totalProducts: stats._count,
        totalStockValueAtPurchase,
        totalStockValueAtSale,
        lowStockCount,
        outOfStockCount,
      },
      items,
    },
    meta: {
      cursor: null,
      hasMore: false,
      total: items.length,
    },
  }
}

// === Day Book ===

export async function getDayBook(businessId: string, query: DayBookQuery) {
  const { date, type, limit } = query

  const dayStart = new Date(date)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1)
  const dateFilter = { gte: dayStart, lte: dayEnd }

  // Get all transactions for the day in parallel
  const [sales, purchases, paymentsIn, paymentsOut] = await Promise.all([
    (!type || type === 'sale') ? prisma.document.findMany({
      where: {
        businessId, type: 'SALE_INVOICE', status: { in: ['SAVED', 'SHARED'] },
        documentDate: dateFilter,
      },
      select: {
        id: true, documentNumber: true, grandTotal: true, documentDate: true,
        party: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    }) : [],

    (!type || type === 'purchase') ? prisma.document.findMany({
      where: {
        businessId, type: 'PURCHASE_INVOICE', status: { in: ['SAVED', 'SHARED'] },
        documentDate: dateFilter,
      },
      select: {
        id: true, documentNumber: true, grandTotal: true, documentDate: true,
        party: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    }) : [],

    (!type || type === 'payment_in') ? prisma.payment.findMany({
      where: {
        businessId, type: 'PAYMENT_IN', isDeleted: false, date: dateFilter,
      },
      select: {
        id: true, amount: true, date: true, mode: true, referenceNumber: true,
        party: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    }) : [],

    (!type || type === 'payment_out') ? prisma.payment.findMany({
      where: {
        businessId, type: 'PAYMENT_OUT', isDeleted: false, date: dateFilter,
      },
      select: {
        id: true, amount: true, date: true, mode: true, referenceNumber: true,
        party: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    }) : [],
  ])

  type DayBookTxn = {
    id: string; time: string; type: string; description: string;
    reference: string; referenceId: string; partyName: string;
    amount: number; mode?: string;
  }

  const transactions: DayBookTxn[] = []

  for (const s of sales) {
    transactions.push({
      id: s.id, time: formatTime(s.documentDate), type: 'sale',
      description: 'Sale Invoice', reference: s.documentNumber || '',
      referenceId: s.id, partyName: s.party.name, amount: s.grandTotal,
    })
  }
  for (const p of purchases) {
    transactions.push({
      id: p.id, time: formatTime(p.documentDate), type: 'purchase',
      description: 'Purchase Invoice', reference: p.documentNumber || '',
      referenceId: p.id, partyName: p.party.name, amount: p.grandTotal,
    })
  }
  for (const pi of paymentsIn) {
    transactions.push({
      id: pi.id, time: formatTime(pi.date), type: 'payment_in',
      description: 'Payment Received', reference: pi.referenceNumber || '',
      referenceId: pi.id, partyName: pi.party.name, amount: pi.amount, mode: pi.mode,
    })
  }
  for (const po of paymentsOut) {
    transactions.push({
      id: po.id, time: formatTime(po.date), type: 'payment_out',
      description: 'Payment Made', reference: po.referenceNumber || '',
      referenceId: po.id, partyName: po.party.name, amount: po.amount, mode: po.mode,
    })
  }

  const salesTotal = sales.reduce((s, i) => s + i.grandTotal, 0)
  const purchasesTotal = purchases.reduce((s, i) => s + i.grandTotal, 0)
  const paymentsInTotal = paymentsIn.reduce((s, i) => s + i.amount, 0)
  const paymentsOutTotal = paymentsOut.reduce((s, i) => s + i.amount, 0)

  // Navigation: prev/next dates with transactions
  const prevDate = new Date(dayStart)
  prevDate.setDate(prevDate.getDate() - 1)
  const nextDate = new Date(dayStart)
  nextDate.setDate(nextDate.getDate() + 1)

  return {
    data: {
      date,
      dayLabel: dayStart.toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }),
      summary: {
        totalSales: { count: sales.length, amount: salesTotal },
        totalPurchases: { count: purchases.length, amount: purchasesTotal },
        paymentsIn: { count: paymentsIn.length, amount: paymentsInTotal },
        paymentsOut: { count: paymentsOut.length, amount: paymentsOutTotal },
        expenses: { count: 0, amount: 0 }, // Expenses module in Phase 2
        stockAdjustments: { count: 0, amount: 0 }, // Could query StockMovement
        netCashFlow: paymentsInTotal - paymentsOutTotal,
      },
      transactions,
      navigation: {
        prevDate: prevDate.toISOString().split('T')[0],
        nextDate: nextDate <= new Date() ? nextDate.toISOString().split('T')[0] : null,
      },
    },
    meta: { cursor: null, hasMore: false, total: transactions.length },
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// === Payment History ===

export async function getPaymentHistory(businessId: string, query: PaymentHistoryQuery) {
  const { from, to, partyId, mode, type, groupBy, sortBy, limit } = query

  const where: Record<string, unknown> = {
    businessId,
    isDeleted: false,
  }
  if (from || to) {
    where.date = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to) }),
    }
  }
  if (partyId) where.partyId = partyId
  if (mode) where.mode = mode.toUpperCase()
  if (type === 'in') where.type = 'PAYMENT_IN'
  if (type === 'out') where.type = 'PAYMENT_OUT'

  const orderField = sortBy.startsWith('amount') ? 'amount' : 'date'
  const orderDir = sortBy.endsWith('asc') ? 'asc' : 'desc'

  const [payments, total, inAgg, outAgg] = await Promise.all([
    prisma.payment.findMany({
      where,
      select: {
        id: true, date: true, type: true, mode: true, amount: true,
        referenceNumber: true, notes: true,
        party: { select: { id: true, name: true } },
        allocations: {
          select: {
            invoice: { select: { id: true, documentNumber: true } },
          },
          take: 1,
        },
      },
      orderBy: { [orderField]: orderDir },
      take: limit + 1,
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({
      where: { ...where, type: 'PAYMENT_IN' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { ...where, type: 'PAYMENT_OUT' },
      _sum: { amount: true },
      _count: true,
    }),
  ])

  const hasMore = payments.length > limit
  const resultItems = payments.slice(0, limit)

  const mapped = resultItems.map(p => ({
    id: p.id,
    date: p.date.toISOString(),
    partyId: p.party.id,
    partyName: p.party.name,
    type: p.type === 'PAYMENT_IN' ? 'in' : 'out',
    mode: p.mode,
    amount: p.amount,
    reference: p.referenceNumber || '',
    invoiceId: p.allocations[0]?.invoice?.id || null,
    invoiceNumber: p.allocations[0]?.invoice?.documentNumber || null,
    notes: p.notes || '',
  }))

  return {
    data: {
      summary: {
        totalReceived: inAgg._sum.amount || 0,
        totalPaid: outAgg._sum.amount || 0,
        net: (inAgg._sum.amount || 0) - (outAgg._sum.amount || 0),
        countIn: inAgg._count,
        countOut: outAgg._count,
      },
      items: groupBy === 'none' ? mapped : undefined,
      groups: groupBy !== 'none' ? groupPayments(mapped, groupBy) : undefined,
    },
    meta: {
      cursor: hasMore ? resultItems[resultItems.length - 1].id : null,
      hasMore,
      total,
    },
  }
}

function groupPayments(items: Array<{ date: string; partyName: string; mode: string; amount: number; type: string }>, groupBy: string) {
  const groups = new Map<string, typeof items>()

  for (const item of items) {
    let key: string
    if (groupBy === 'party') key = item.partyName
    else if (groupBy === 'mode') key = item.mode
    else if (groupBy === 'day') key = item.date.substring(0, 10)
    else key = 'All'

    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }

  return Array.from(groups.entries()).map(([key, groupItems]) => ({
    key,
    label: key,
    totalReceived: groupItems.filter(i => i.type === 'in').reduce((s, i) => s + i.amount, 0),
    totalPaid: groupItems.filter(i => i.type === 'out').reduce((s, i) => s + i.amount, 0),
    count: groupItems.length,
    items: groupItems,
  }))
}
