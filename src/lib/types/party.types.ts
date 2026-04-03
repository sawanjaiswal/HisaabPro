/** Shared party types — used by invoices, payments, and parties features */

export type { PartyType } from '@shared/enums'
export { PARTY_TYPES } from '@shared/enums'

// Re-import for use in this file's interface
import type { PartyType } from '@shared/enums'

/** Party summary in list view */
export interface PartySummary {
  id: string
  name: string
  phone?: string
  type: PartyType
  group?: { id: string; name: string }
  tags: string[]
  outstandingBalance: number // paise, positive = receivable
  creditLimit: number
  lastTransactionAt?: string
  isActive: boolean
}
