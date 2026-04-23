/**
 * Shared helpers for GST return generation.
 */

export interface PeriodRange { gte: Date; lte: Date }

export function parsePeriod(period: string): PeriodRange {
  const [year, month] = period.split('-').map(Number)
  const gte = new Date(year, month - 1, 1)
  const lte = new Date(year, month, 0, 23, 59, 59, 999)
  return { gte, lte }
}

export function parseFinancialYear(period: string): PeriodRange {
  const [year, month] = period.split('-').map(Number)
  // FY starts April of the year, ends March next year
  const fyStart = month >= 4 ? year : year - 1
  return { gte: new Date(fyStart, 3, 1), lte: new Date(fyStart + 1, 2, 31, 23, 59, 59, 999) }
}

export const savedDocWhere = (businessId: string, range: PeriodRange, types: string[]) => ({
  businessId,
  status: 'SAVED',
  type: { in: types },
  documentDate: range,
  deletedAt: null,
})

export function sumField(docs: Array<{ totalTaxableValue: number }>, field: 'totalTaxableValue') {
  return docs.reduce((sum, d) => sum + d[field], 0)
}

export function sumTax(docs: Array<{ totalCgst: number; totalSgst: number; totalIgst: number; totalCess: number }>) {
  return docs.reduce((sum, d) => sum + d.totalCgst + d.totalSgst + d.totalIgst + d.totalCess, 0)
}

export function formatDateDDMMYYYY(date: Date): string {
  const d = new Date(date)
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}
