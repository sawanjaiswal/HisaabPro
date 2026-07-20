/** Expenses — Type definitions */

export type ExpensePaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD'

export interface ExpenseCategory {
  id: string
  businessId: string
  name: string
  icon: string | null
  color: string | null
  isSystem: boolean
  createdAt: string
  /** Non-deleted expenses filed under this category (list endpoint only). */
  expenseCount?: number
}

export interface Expense {
  id: string
  businessId: string
  categoryId: string | null
  categoryName: string | null
  amount: number             // paise
  date: string               // ISO date string
  paymentMode: ExpensePaymentMode
  notes: string | null
  referenceNumber: string | null
  /** Attached bill image, when one was uploaded (detail page #13). */
  receiptUrl?: string | null
  partyId: string | null
  partyName: string | null
  createdAt: string
  updatedAt: string
}

export interface ExpenseListResponse {
  items: Expense[]
  total: number
  page: number
  limit: number
}

export interface ExpenseSummary {
  totalAmount: number        // paise
  byCategory: Array<{
    categoryId: string | null
    categoryName: string | null
    totalAmount: number
  }>
}

export interface CreateExpenseInput {
  categoryId?: string
  amount: number             // paise
  date: string
  paymentMode: ExpensePaymentMode
  notes?: string
  referenceNumber?: string
  partyId?: string
}

export interface CreateExpenseCategoryInput {
  name: string
  icon?: string
  color?: string
}

// ─── Recurring Templates ────────────────────────────────────────────────────

export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

export interface RecurringTemplate {
  id: string
  businessId: string
  categoryId: string
  categoryName: string | null
  amountPaise: number        // paise
  frequency: RecurringFrequency
  dayOfMonth: number | null
  dayOfWeek: number | null
  paymentMode: ExpensePaymentMode
  partyId: string | null
  partyName: string | null
  notes: string | null
  isActive: boolean
  nextRunDate: string        // ISO date string
  createdAt: string
  updatedAt: string
}

export interface CreateTemplateInput {
  categoryId: string
  amountPaise: number        // paise
  frequency: RecurringFrequency
  dayOfMonth?: number
  dayOfWeek?: number
  nextRunDate: string
  paymentMode: ExpensePaymentMode
  partyId?: string
  notes?: string
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>

// ─── Budget ─────────────────────────────────────────────────────────────────

export type BudgetSeverity = 'ok' | 'warn' | 'over'

export interface BudgetUsageItem {
  id: string
  categoryId: string | null
  categoryName: string | null
  month: string              // YYYY-MM
  budgetPaise: number
  spentPaise: number
  percent: number
  severity: BudgetSeverity
}

export interface CreateBudgetInput {
  categoryId?: string
  month: string              // YYYY-MM
  amount: number             // paise
}

// ─── Pending Confirmation ────────────────────────────────────────────────────

export interface PendingExpenseItem {
  id: string
  categoryId: string | null
  categoryName: string | null
  amount: number             // paise
  date: string
  paymentMode: ExpensePaymentMode
  notes: string | null
  recurringTemplateId: string | null
  createdAt: string
}

// ─── OCR ─────────────────────────────────────────────────────────────────────

export interface OcrResult {
  amountPaise: number | null
  vendor: string | null
  date: string | null        // YYYY-MM-DD
  suggestedCategoryId: string | null
  confidence: number         // 0..1
  sourceHash: string | null
}

export interface OcrResponse {
  success: boolean
  data?: OcrResult
  error?: { code: 'IMAGE_TOO_LARGE' | 'OCR_UNAVAILABLE' | string }
}

// ─── Trend ───────────────────────────────────────────────────────────────────

export interface TrendBucketCategory {
  categoryId: string
  name: string
  paise: number
}

export interface TrendPoint {
  monthYmd: string           // YYYY-MM-DD (first of month)
  totalPaise: number
  byCategory: TrendBucketCategory[]
}

// ─── Budget check ────────────────────────────────────────────────────────────

export interface BudgetCheckResult {
  wouldExceed: boolean
  currentSpent: number
  budgetAmount: number
  percentAfter: number
}
