/**
 * GSTR-9 — Annual Return Summary.
 * Groups saved documents by type over a financial year.
 */

import { prisma } from '../../lib/prisma.js'
import { parseFinancialYear, savedDocWhere } from './helpers.js'

export async function generateGstr9(businessId: string, period: string) {
  const range = parseFinancialYear(period)

  const types = ['SALE_INVOICE', 'PURCHASE_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE']
  const docs = await prisma.document.groupBy({
    by: ['type'],
    where: savedDocWhere(businessId, range, types),
    _sum: { totalTaxableValue: true, totalCgst: true, totalSgst: true, totalIgst: true, totalCess: true, grandTotal: true },
    _count: true,
  })

  const byType = (t: string) => {
    const d = docs.find((r) => r.type === t)
    return {
      count: d?._count ?? 0,
      taxable: d?._sum.totalTaxableValue ?? 0,
      cgst: d?._sum.totalCgst ?? 0,
      sgst: d?._sum.totalSgst ?? 0,
      igst: d?._sum.totalIgst ?? 0,
      cess: d?._sum.totalCess ?? 0,
      total: d?._sum.grandTotal ?? 0,
    }
  }

  return {
    financialYear: `${range.gte.getFullYear()}-${range.lte.getFullYear()}`,
    sales: byType('SALE_INVOICE'),
    purchases: byType('PURCHASE_INVOICE'),
    creditNotes: byType('CREDIT_NOTE'),
    debitNotes: byType('DEBIT_NOTE'),
  }
}
