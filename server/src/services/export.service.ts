/**
 * Data export service — CSV export of all business data for owners.
 * Uses Prisma select to minimize memory footprint.
 */

import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'

interface ExportRow {
  [key: string]: string | number | boolean | null
}

/** Convert array of objects to CSV string */
function toCsv(rows: ExportRow[], columns: string[]): string {
  if (rows.length === 0) return columns.join(',') + '\n'

  const header = columns.join(',')
  const lines = rows.map((row) =>
    columns.map((col) => {
      const val = row[col]
      if (val === null || val === undefined) return ''
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',')
  )

  return [header, ...lines].join('\n') + '\n'
}

/** Export parties as CSV */
async function exportParties(businessId: string): Promise<string> {
  const parties = await prisma.party.findMany({
    where: { businessId, isDeleted: false },
    select: {
      name: true, phone: true, email: true, type: true,
      companyName: true, gstin: true, pan: true,
      outstandingBalance: true, totalBusiness: true,
      isActive: true, createdAt: true,
    },
    take: 50000,
  })

  return toCsv(
    parties.map((p) => ({
      ...p,
      outstandingBalance: Number(p.outstandingBalance) / 100,
      totalBusiness: Number(p.totalBusiness) / 100,
      createdAt: p.createdAt.toISOString(),
    })),
    ['name', 'phone', 'email', 'type', 'companyName', 'gstin', 'pan',
     'outstandingBalance', 'totalBusiness', 'isActive', 'createdAt']
  )
}

/** Export products as CSV */
async function exportProducts(businessId: string): Promise<string> {
  const products = await prisma.product.findMany({
    where: { businessId, isDeleted: false },
    select: {
      name: true, sku: true, status: true,
      salePrice: true, purchasePrice: true,
      currentStock: true, minStockLevel: true,
      hsnCode: true, createdAt: true,
      unit: { select: { symbol: true } },
      category: { select: { name: true } },
    },
    take: 50000,
  })

  return toCsv(
    products.map((p) => ({
      name: p.name,
      sku: p.sku,
      status: p.status,
      salePrice: Number(p.salePrice) / 100,
      purchasePrice: p.purchasePrice ? Number(p.purchasePrice) / 100 : null,
      currentStock: Number(p.currentStock),
      minStockLevel: Number(p.minStockLevel),
      unit: p.unit?.symbol ?? '',
      category: p.category?.name ?? '',
      hsnCode: p.hsnCode,
      createdAt: p.createdAt.toISOString(),
    })),
    ['name', 'sku', 'status', 'salePrice', 'purchasePrice', 'currentStock',
     'minStockLevel', 'unit', 'category', 'hsnCode', 'createdAt']
  )
}

/** Export documents/invoices as CSV */
async function exportDocuments(businessId: string): Promise<string> {
  const docs = await prisma.document.findMany({
    where: { businessId, isDeleted: false },
    select: {
      documentNumber: true, type: true, status: true,
      documentDate: true, dueDate: true,
      subtotal: true, totalTaxableValue: true,
      totalCgst: true, totalSgst: true, totalIgst: true,
      grandTotal: true,
      party: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { documentDate: 'desc' },
    take: 100000,
  })

  return toCsv(
    docs.map((d) => ({
      documentNumber: d.documentNumber,
      type: d.type,
      status: d.status,
      partyName: d.party?.name ?? '',
      documentDate: d.documentDate.toISOString().split('T')[0],
      dueDate: d.dueDate?.toISOString().split('T')[0] ?? '',
      subtotal: Number(d.subtotal) / 100,
      taxAmount: (Number(d.totalCgst) + Number(d.totalSgst) + Number(d.totalIgst)) / 100,
      grandTotal: Number(d.grandTotal) / 100,
      createdAt: d.createdAt.toISOString(),
    })),
    ['documentNumber', 'type', 'status', 'partyName', 'documentDate', 'dueDate',
     'subtotal', 'taxAmount', 'grandTotal', 'createdAt']
  )
}

/** Export payments as CSV */
async function exportPayments(businessId: string): Promise<string> {
  const payments = await prisma.payment.findMany({
    where: { businessId, isDeleted: false },
    select: {
      type: true, mode: true,
      amount: true, date: true, referenceNumber: true, notes: true,
      party: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { date: 'desc' },
    take: 100000,
  })

  return toCsv(
    payments.map((p) => ({
      type: p.type,
      mode: p.mode,
      partyName: p.party?.name ?? '',
      amount: Number(p.amount) / 100,
      date: p.date.toISOString().split('T')[0],
      referenceNumber: p.referenceNumber,
      notes: p.notes,
      createdAt: p.createdAt.toISOString(),
    })),
    ['type', 'mode', 'partyName', 'amount', 'date', 'referenceNumber', 'notes', 'createdAt']
  )
}

/** Export expenses as CSV */
async function exportExpenses(businessId: string): Promise<string> {
  const expenses = await prisma.expense.findMany({
    where: { businessId, isDeleted: false },
    select: {
      amount: true, notes: true, date: true,
      paymentMode: true, referenceNumber: true,
      category: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { date: 'desc' },
    take: 100000,
  })

  return toCsv(
    expenses.map((e) => ({
      category: e.category?.name ?? '',
      amount: Number(e.amount) / 100,
      notes: e.notes,
      date: e.date.toISOString().split('T')[0],
      paymentMode: e.paymentMode,
      referenceNumber: e.referenceNumber,
      createdAt: e.createdAt.toISOString(),
    })),
    ['category', 'amount', 'notes', 'date', 'paymentMode', 'referenceNumber', 'createdAt']
  )
}

export interface ExportResult {
  parties: string
  products: string
  documents: string
  payments: string
  expenses: string
  exportedAt: string
}

/** Generate full business data export as CSV files */
export async function generateFullExport(businessId: string): Promise<ExportResult> {
  logger.info('Generating full data export', { businessId })

  const [parties, products, documents, payments, expenses] = await Promise.all([
    exportParties(businessId),
    exportProducts(businessId),
    exportDocuments(businessId),
    exportPayments(businessId),
    exportExpenses(businessId),
  ])

  return {
    parties,
    products,
    documents,
    payments,
    expenses,
    exportedAt: new Date().toISOString(),
  }
}
