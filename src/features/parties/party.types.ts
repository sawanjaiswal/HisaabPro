/** Party Management — Type definitions */

// Shared types re-exported from lib for backward compatibility within this feature
export type { PartyType, PartySummary } from '@/lib/types/party.types'
import type { PartyType, PartySummary } from '@/lib/types/party.types'
export type CreditLimitMode = 'WARN' | 'BLOCK'
export type AddressType = 'BILLING' | 'SHIPPING'
export type BalanceType = 'RECEIVABLE' | 'PAYABLE'
export type CustomFieldType = 'TEXT' | 'MULTILINE' | 'NUMBER' | 'DATE' | 'DROPDOWN'

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

/** Hero summary-tile stats returned alongside the party detail payload. */
export interface PartyDetailStats {
  /** Sum of this calendar month's sale-invoice grand totals (paise). */
  salesMtd: number
  /** Count of this calendar month's sale invoices. */
  invoiceCountMtd: number
  /** Most recent incoming payment, or null when the party has never paid. */
  lastPayment: { amount: number; date: string; mode: string } | null
  /** True when any non-deleted sale invoice is past its due date with balance owing. */
  isOverdue: boolean
  /** Whole days the oldest still-owing overdue invoice is past due; 0 when none. */
  oldestDueDays: number
  /** Count of non-draft invoices with balance still owing (overdue or not). */
  openInvoiceCount: number
  /** Oldest still-owing overdue invoice — drives the alert banner. Null hides it. */
  oldestOverdueInvoice: {
    id: string
    number: string
    /** Balance still owing on that invoice (paise), not its grand total. */
    amountPaise: number
    daysOverdue: number
  } | null
}

/** Full party detail */
export interface PartyDetail extends PartySummary {
  /** Hero-tile aggregates (sales MTD, last payment, overdue) — server-derived. */
  stats?: PartyDetailStats
  version?: number // #150 optimistic-lock token
  email?: string
  companyName?: string
  gstin?: string
  pan?: string
  gstinVerified?: boolean
  gstinLegalName?: string
  gstinStatus?: string
  /** Credit limit in paise (server-selected on the detail payload). 0 = no limit. */
  creditLimit: number
  creditLimitMode: CreditLimitMode
  totalBusiness: number
  notes?: string
  addresses: PartyAddress[]
  /** Server returns `customFieldValues` with full def join (name + fieldType + sortOrder) */
  customFieldValues: Array<{
    id: string
    fieldId: string
    value: string
    field: { name: string; fieldType: CustomFieldType; showOnInvoice: boolean; sortOrder: number }
  }>
  openingBalance?: OpeningBalance
  pricing: PartyPricingItem[]
  createdAt: string
  updatedAt: string
  // price list assignment (Batch 5)
  priceListId?: string | null
  priceList?: { id: string; name: string; isDefault: boolean } | null
  // portal binding — null = unclaimed, string = bound userId (Epic C PR5)
  userId?: string | null
  // CRM (#127) — server returns these on detail; client patches via PATCH.
  followUpAt?: string | null
  lastContactedAt?: string | null
  loyaltyOptOut?: boolean
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
  /** undefined = both active + inactive (the "All" status pill) */
  isActive?: boolean
  sortBy: 'name' | 'outstanding' | 'recentTransaction' | 'createdAt'
  sortOrder: 'asc' | 'desc'
  // CRM #127 — single-tag narrow filter (TagFilterBar chips).
  // Coexists server-side with multi-tag `tags[]` (hasSome). Empty string means
  // "no tag filter" so the chip-bar can reset cleanly.
  tag?: string
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
  /** Custom field values keyed by definition id. Empty/null values are stripped before submit. */
  customFields: { fieldId: string; value: string }[]
  openingBalance?: {
    amount: number
    type: BalanceType
    asOfDate: string
    notes?: string
  }
  priceListId?: string | null
}
