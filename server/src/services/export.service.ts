/**
 * Data export service — CSV export of all business data for owners.
 * Streams data to avoid loading entire DB into memory.
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
      // Escape CSV: wrap in quotes if contains comma, quote, or newline
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
      outstandingBalance: Number(p.outstandingBalance) / 100, // paise → rupees
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
      name: true, sku: true, type: true,
      salePrice: true, purchasePrice: true,
      currentStock: true, lowStockThreshold: true,
      hsn: true, isActive: true, createdAt: true,
      unit: { select: { symbol: true } },
      category: { select: { name: true } },
    },
    take: 50000,
  })

  return toCsv(
    products.map((p) => ({
      name: p.name,
      sku: p.sku,
      type: p.type,
      salePrice: Number(p.salePrice) / 100,
      purchasePrice: Number(p.purchasePrice) / 100,
      currentStock: Number(p.currentStock),
      lowStockThreshold: p.lowStockThreshold,
      unit: p.unit?.symbol ?? '',
      category: p.category?.name ?? '',
      hsn: p.hsn,
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
    })),
    ['name', 'sku', 'type', 'salePrice', 'purchasePrice', 'currentStock',
     'lowStockThreshold', 'unit', 'category', 'hsn', 'isActive', 'createdAt']
  )
}

/** Export invoices as CSV */
async function exportDocuments(businessId: string): Promise<string> {
  const docs = await prisma.document.findMany({
    where: { businessId, isDeleted: false },
    select: {
      documentNumber: true, type: true, status: true,
      documentDate: true, dueDate: true,
      subtotal: true, taxAmount: true, totalAmount: true,
      paidAmount: true, balanceDue: true,
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
      documentDate: d.documentDate?.toISOString().split('T')[0] ?? '',
      dueDate: d.dueDate?.toISOString().split('T')[0] ?? '',
      subtotal: Number(d.subtotal) / 100,
      taxAmount: Number(d.taxAmount) / 100,
      totalAmount: Number(d.totalAmount) / 100,
      paidAmount: Number(d.paidAmount) / 100,
      balanceDue: Number(d.balanceDue) / 100,
      createdAt: d.createdAt.toISOString(),
    })),
    ['documentNumber', 'type', 'status', 'partyName', 'documentDate', 'dueDate',
     'subtotal', 'taxAmount', 'totalAmount', 'paidAmount', 'balanceDue', 'createdAt']
  )
}

/** Export payments as CSV */
async function exportPayments(businessId: string): Promise<string> {
  const payments = await prisma.payment.findMany({
    where: { businessId, isDeleted: false },
    select: {
      paymentNumber: true, type: true, mode: true, status: true,
      amount: true, paymentDate: true, reference: true, notes: true,
      party: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { paymentDate: 'desc' },
    take: 100000,
  })

  return toCsv(
    payments.map((p) => ({
      paymentNumber: p.paymentNumber,
      type: p.type,
      mode: p.mode,
      status: p.status,
      partyName: p.party?.name ?? '',
      amount: Number(p.amount) / 100,
      paymentDate: p.paymentDate?.toISOString().split('T')[0] ?? '',
      reference: p.reference,
      notes: p.notes,
      createdAt: p.createdAt.toISOString(),
    })),
    ['paymentNumber', 'type', 'mode', 'status', 'partyName', 'amount',
     'paymentDate', 'reference', 'notes', 'createdAt']
  )
}

/** Export expenses as CSV */
async function exportExpenses(businessId: string): Promise<string> {
  const expenses = await prisma.expense.findMany({
    where: { businessId, isDeleted: false },
    select: {
      amount: true, description: true, expenseDate: true,
      paymentMode: true, reference: true,
      category: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { expenseDate: 'desc' },
    take: 100000,
  })

  return toCsv(
    expenses.map((e) => ({
      category: e.category?.name ?? '',
      amount: Number(e.amount) / 100,
      description: e.description,
      expenseDate: e.expenseDate?.toISOString().split('T')[0] ?? '',
      paymentMode: e.paymentMode,
      reference: e.reference,
      createdAt: e.createdAt.toISOString(),
    })),
    ['category', 'amount', 'description', 'expenseDate', 'paymentMode', 'reference', 'createdAt']
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
