/** Shared party types — used by invoices, payments, and parties features */

export type PartyType = 'CUSTOMER' | 'SUPPLIER' | 'BOTH'

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
