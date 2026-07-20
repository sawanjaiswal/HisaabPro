/** Financial Reports — Type definitions */

// ─── Profit & Loss ───────────────────────────────────────────────────────────

/** One ledger account's contribution to a P&L group. */
export interface ProfitLossLine {
  accountName: string
  amount: number              // paise
}

export interface ProfitLossIncome {
  sales: number               // paise
  otherIncome: number         // paise
  totalIncome: number         // paise
  breakdown: ProfitLossLine[]
}

export interface ProfitLossExpenses {
  purchases: number           // paise
  directExpenses: number      // paise
  indirectExpenses: number    // paise
  totalExpenses: number       // paise
  breakdown: ProfitLossLine[]
}

export interface ProfitLossTrendPoint {
  date: string                // YYYY-MM-DD
  amount: number              // paise, may be negative
}

export interface ProfitLossTrend {
  series: ProfitLossTrendPoint[]
  previousNetProfit: number   // paise
}

/**
 * Mirrors `getProfitAndLoss()` in server/src/services/reports/profit-and-loss.ts.
 * Keep the field names identical — this type is the only thing standing between
 * the page and a runtime crash (see .claude/fix-trace-pl-contract.md).
 */
export interface ProfitLossData {
  period: { from: string; to: string }
  income: ProfitLossIncome
  expenses: ProfitLossExpenses
  grossProfit: number         // paise
  netProfit: number           // paise
  trend: ProfitLossTrend
}

// ─── Balance Sheet ────────────────────────────────────────────────────────────

export interface BalanceSheetSection {
  label: string
  total: number               // paise
  items: Array<{ label: string; amount: number }>
}

export interface BalanceSheetData {
  asOf: string
  assets: BalanceSheetSection
  liabilities: BalanceSheetSection
  equity: BalanceSheetSection
}

// ─── Cash Flow ────────────────────────────────────────────────────────────────

export interface CashFlowSection {
  label: string
  netAmount: number           // paise
  items: Array<{ label: string; amount: number }>
}

export interface CashFlowData {
  from: string
  to: string
  operating: CashFlowSection
  investing: CashFlowSection
  financing: CashFlowSection
  netCashFlow: number         // paise
}

// ─── Aging Report ─────────────────────────────────────────────────────────────

export type AgingType = 'RECEIVABLE' | 'PAYABLE'

export interface AgingRow {
  partyId: string
  partyName: string
  current: number             // paise (0-30 days)
  days31to60: number          // paise
  days61to90: number          // paise
  over90: number              // paise
  total: number               // paise
}

export interface AgingReportData {
  type: AgingType
  asOf: string
  rows: AgingRow[]
  totals: Omit<AgingRow, 'partyId' | 'partyName'>
}

// ─── Profitability ────────────────────────────────────────────────────────────

export type ProfitabilityGroupBy = 'PARTY' | 'PRODUCT' | 'DOCUMENT'

export interface ProfitabilityRow {
  groupId: string
  groupLabel: string
  revenue: number             // paise
  costOfGoods: number         // paise
  grossProfit: number         // paise
  grossMargin: number         // percentage, e.g. 28.5
}

export interface ProfitabilityData {
  from: string
  to: string
  groupBy: ProfitabilityGroupBy
  rows: ProfitabilityRow[]
}

// ─── Discount Report ─────────────────────────────────────────────────────────

export interface DiscountRow {
  documentId: string
  documentNumber: string
  partyName: string
  date: string
  subtotal: number            // paise
  discountAmount: number      // paise
  discountPercent: number     // e.g. 5.0
  total: number               // paise
}

export interface DiscountReportData {
  from: string
  to: string
  rows: DiscountRow[]
  totalDiscount: number       // paise
}

// ─── FY Closure ──────────────────────────────────────────────────────────────

export interface FYClosure {
  id: string
  financialYear: string
  closedAt: string
  closedBy: string
  retainedEarnings: number    // paise
  status: 'CLOSED' | 'REOPENED'
  journalEntryId: string | null
}

export interface FYClosureResult {
  closure: FYClosure
  journalEntryId: string
  entryNumber: string
  netProfit: number           // paise
  totalIncome: number         // paise
  totalExpenses: number       // paise
  accountsReset: number
}
