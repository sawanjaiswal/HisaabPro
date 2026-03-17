/** Recurring Invoices — Type definitions
 *
 * Written first — all other layers import from here.
 * Matches API response shape from /api/recurring.
 */

export type RecurringFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

export type RecurringStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED'

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
  status: RecurringStatus
  generatedCount: number
  lastGeneratedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface RecurringListResponse {
  items: RecurringInvoice[]
  total: number
  page: number
  limit: number
}

export interface CreateRecurringInput {
  templateDocumentId: string
  frequency: RecurringFrequency
  startDate: string
  endDate?: string
  dayOfMonth?: number
  dayOfWeek?: number
  autoSend?: boolean
}

export interface UpdateRecurringInput {
  frequency?: RecurringFrequency
  endDate?: string | null
  dayOfMonth?: number | null
  dayOfWeek?: number | null
  autoSend?: boolean
  status?: RecurringStatus
}
