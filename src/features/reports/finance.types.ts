/** Financial Reports — Type definitions */

// ─── Profit & Loss ───────────────────────────────────────────────────────────

export interface ProfitLossSection {
  label: string
  amount: number              // paise
  items: Array<{ label: string; amount: number }>
}

export interface ProfitLossData {
  from: string
  to: string
  revenue: ProfitLossSection
  costOfGoods: ProfitLossSection
  grossProfit: number         // paise
  expenses: ProfitLossSection
  otherIncome: ProfitLossSection
  netProfit: number           // paise
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
