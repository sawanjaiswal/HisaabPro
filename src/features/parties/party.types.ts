/** Party Management — Type definitions */

// Shared types re-exported from lib for backward compatibility within this feature
export type { PartyType, PartySummary } from '@/lib/types/party.types'
import type { PartyType, PartySummary } from '@/lib/types/party.types'
export type CreditLimitMode = 'WARN' | 'BLOCK'
export type AddressType = 'BILLING' | 'SHIPPING'
export type BalanceType = 'RECEIVABLE' | 'PAYABLE'
export type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'DROPDOWN'

export interface PartyGroup {
  id: string
  name: string
  description?: string
  color: string
  partyCount: number
}

export interface PartyAddress {
  id: string
  label: string
  line1: string
  line2?: string
  city: string
  state: string
  pincode: string
  type: AddressType
  isDefault: boolean
}

export interface CustomFieldValue {
  fieldId: string
  fieldName: string
  fieldType: CustomFieldType
  value: string
}

export interface OpeningBalance {
  amount: number // in paise
  type: BalanceType
  asOfDate: string
  notes?: string
}

export interface PartyPricingItem {
  productId: string
  productName: string
  defaultPrice: number
  customPrice: number
  minQty: number
}

/** Full party detail */
export interface PartyDetail extends PartySummary {
  email?: string
  companyName?: string
  gstin?: string
  pan?: string
  gstinVerified?: boolean
  gstinLegalName?: string
  gstinStatus?: string
  creditLimitMode: CreditLimitMode
  totalBusiness: number
  notes?: string
  addresses: PartyAddress[]
  customFields: CustomFieldValue[]
  openingBalance?: OpeningBalance
  pricing: PartyPricingItem[]
  createdAt: string
  updatedAt: string
}

/** List response with pagination + summary */
export interface PartyListResponse {
  parties: PartySummary[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: {
    totalReceivable: number
    totalPayable: number
    netOutstanding: number
    totalParties: number
    customersCount: number
    suppliersCount: number
    bothCount: number
  }
}

/** Filters for party list */
export interface PartyFilters {
  page: number
  limit: number
  search: string
  type: PartyType | 'ALL'
  groupId?: string
  hasOutstanding?: boolean
  isActive: boolean
  sortBy: 'name' | 'outstanding' | 'recentTransaction' | 'createdAt'
  sortOrder: 'asc' | 'desc'
}

/** Party transaction ledger entry — combined invoices + payments */
export interface PartyTransaction {
  id: string
  date: string
  type: 'INVOICE' | 'PAYMENT'
  /** Document number (INV-001) or payment reference */
  reference: string
  /** Human-readable description */
  description: string
  /** Amount in paise — positive for debit (party owes more), negative for credit */
  amount: number
  /** Running balance in paise after this transaction */
  runningBalance: number
  /** Invoice/payment status */
  status: string
}

export interface PartyTransactionListResponse {
  transactions: PartyTransaction[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: {
    totalDebit: number
    totalCredit: number
    closingBalance: number
  }
}

/** Create/update party form data */
export interface PartyFormData {
  name: string
  phone?: string
  email?: string
  companyName?: string
  type: PartyType
  groupId?: string | null
  tags: string[]
  gstin?: string
  pan?: string
  gstinVerified?: boolean
  gstinLegalName?: string
  gstinStatus?: string
  creditLimit: number
  creditLimitMode: CreditLimitMode
  notes?: string
  addresses: Omit<PartyAddress, 'id'>[]
  openingBalance?: {
    amount: number
    type: BalanceType
    asOfDate: string
    notes?: string
  }
}
