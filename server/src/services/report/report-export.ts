/**
 * Report Export — generate CSV exports by delegating to report sub-services.
 */

import { formatPaise, formatExportDate } from './report-helpers.js'
import { getInvoiceReport } from './report-invoice.js'
import { getStockSummary } from './report-stock.js'
import { getPaymentHistory } from './report-payment.js'
import { getDayBook } from './report-daybook.js'

export async function exportReport(
  businessId: string,
  reportType: string,
  filters: Record<string, unknown>,
) {
  let rows: Array<Record<string, unknown>> = []
  let headers: string[] = []

  if (reportType === 'invoices') {
    const type = (filters.type as string) || 'sale'
    const result = await getInvoiceReport(businessId, {
      type: type as 'sale' | 'purchase',
      from: filters.from as string | undefined,
      to: filters.to as string | undefined,
      partyId: filters.partyId as string | undefined,
      groupBy: 'none',
      sortBy: 'date_desc',
      limit: 1000,
    })
    headers = ['Date', 'Invoice No', 'Party', 'Items', 'Amount', 'Paid', 'Balance', 'Status']
    rows = (result.data.items || []).map((i: Record<string, unknown>) => ({
      Date: formatExportDate(i.date as string),
      'Invoice No': i.number,
      Party: i.partyName,
      Items: i.itemCount,
      Amount: formatPaise(i.amount as number),
      Paid: formatPaise(i.paid as number),
      Balance: formatPaise(i.balance as number),
      Status: i.status,
    }))
  } else if (reportType === 'stock_summary') {
    const result = await getStockSummary(businessId, {
      categoryId: filters.categoryId as string | undefined,
      stockStatus: filters.stockStatus as 'in_stock' | 'low' | 'out_of_stock' | undefined,
      search: filters.search as string | undefined,
      sortBy: 'name_asc',
      limit: 1000,
    })
    headers = ['Product', 'Category', 'Unit', 'Current Stock', 'Min Level', 'Purchase Price', 'Sale Price', 'Stock Value', 'Status']
    rows = result.data.items.map((i: Record<string, unknown>) => ({
      Product: i.name,
      Category: i.category,
      Unit: i.unit,
      'Current Stock': i.currentStock,
      'Min Level': i.minStockLevel,
      'Purchase Price': formatPaise(i.purchasePrice as number),
      'Sale Price': formatPaise(i.salePrice as number),
      'Stock Value': formatPaise(i.stockValueAtSale as number),
      Status: i.stockStatus,
    }))
  } else if (reportType === 'payment_history') {
    const result = await getPaymentHistory(businessId, {
      from: filters.from as string | undefined,
      to: filters.to as string | undefined,
      partyId: filters.partyId as string | undefined,
      type: filters.type as 'in' | 'out' | undefined,
      groupBy: 'none',
      sortBy: 'date_desc',
      limit: 1000,
    })
    headers = ['Date', 'Party', 'Type', 'Mode', 'Amount', 'Reference', 'Invoice No']
    rows = (result.data.items || []).map((i: Record<string, unknown>) => ({
      Date: formatExportDate(i.date as string),
      Party: i.partyName,
      Type: i.type === 'in' ? 'Received' : 'Paid',
      Mode: i.mode,
      Amount: formatPaise(i.amount as number),
      Reference: i.reference,
      'Invoice No': i.invoiceNumber || '',
    }))
  } else if (reportType === 'day_book') {
    const result = await getDayBook(businessId, {
      date: (filters.date as string) || new Date().toISOString().split('T')[0],
      limit: 200,
    })
    headers = ['Time', 'Type', 'Description', 'Party', 'Reference', 'Amount']
    rows = result.data.transactions.map((t: Record<string, unknown>) => ({
      Time: t.time,
      Type: t.type,
      Description: t.description,
      Party: t.partyName,
      Reference: t.reference,
      Amount: formatPaise(t.amount as number),
    }))
  }

  const csvLines = [headers.join(',')]
  for (const row of rows) {
    const values = headers.map(h => {
      const val = String(row[h] ?? '')
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val
    })
    csvLines.push(values.join(','))
  }

  return {
    csv: csvLines.join('\n'),
    fileName: `${reportType}-${new Date().toISOString().split('T')[0]}.csv`,
    rowCount: rows.length,
  }
}
