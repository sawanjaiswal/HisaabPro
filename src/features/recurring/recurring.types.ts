/** Recurring Invoices — Type definitions
 *
 * Written first — all other layers import from here.
 * Matches API response shape from /api/recurring.
 */

export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

export type RecurringStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED'

export type RecurringRunStatus = 'SUCCESS' | 'SUCCESS_PARTIAL' | 'FAILED' | 'SKIPPED'

export interface RecurringInvoice {
  id: string
  businessId: string
  templateDocumentId: string
  partyId: string | null
  partyName: string | null
  frequency: RecurringFrequency
  startDate: string        // ISO date string
  endDate: string | null
  nextRunDate: string | null
  dayOfMonth: number | null
  dayOfWeek: number | null // 0 = Sun, 6 = Sat
  autoSend: boolean
  autoPaymentLink: boolean
  autoReminder: boolean
  name: string | null
  status: RecurringStatus
  generatedCount: number
  lastGeneratedAt: string | null
  lastFailureReason: string | null
  createdAt: string
  updatedAt: string
}

export interface RecurringRun {
  id: string
  recurringInvoiceId: string
  businessId: string
  scheduledFor: string     // ISO date string
  ranAt: string            // ISO date string
  status: RecurringRunStatus
  generatedDocumentId: string | null
  paymentLinkId: string | null
  idempotencyKey: string
  errorMessage: string | null
  warning: string | null
  retryCount: number
  triggeredBy: string      // "cron" | userId
  createdAt: string
}

export interface RecurringListResponse {
  items: RecurringInvoice[]
  total: number
  page: number
  limit: number
}

export interface RecurringRunsResponse {
  items: RecurringRun[]
  nextCursor: string | null
}

export interface CreateRecurringInput {
  templateDocumentId: string
  name?: string
  frequency: RecurringFrequency
  startDate: string
  endDate?: string
  dayOfMonth?: number
  dayOfWeek?: number
  autoSend?: boolean
  autoPaymentLink?: boolean
  autoReminder?: boolean
}

export interface UpdateRecurringInput {
  name?: string | null
  frequency?: RecurringFrequency
  endDate?: string | null
  dayOfMonth?: number | null
  dayOfWeek?: number | null
  autoSend?: boolean
  autoPaymentLink?: boolean
  autoReminder?: boolean
  status?: RecurringStatus
}
