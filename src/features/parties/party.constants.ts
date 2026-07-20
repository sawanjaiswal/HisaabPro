/** Party Management — Constants */

import type { PartyType, PartyFilters } from './party.types'

export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  CUSTOMER: 'Customer',
  SUPPLIER: 'Supplier',
  BOTH: 'Both',
  // Phase 6 #136 PR1A — STAFF parties are payroll-routing only; deliberately
  // omitted from PARTY_TYPE_OPTIONS so they never surface in customer pickers
  // (filter-by-absence per architecture M7 closure).
  STAFF: 'Staff',
}

export const PARTY_TYPE_OPTIONS: { value: PartyType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'SUPPLIER', label: 'Suppliers' },
  { value: 'BOTH', label: 'Both' },
]

/** Type filter chips (All / Customers / Suppliers / Both) — mockup v2.
 * Counts come from the list summary; labelKey resolves via useLanguage(). */
export const PARTY_TYPE_FILTER_OPTIONS: {
  value: PartyType | 'ALL'
  labelKey: 'all' | 'customers' | 'suppliers' | 'both'
  countKey: 'totalParties' | 'customersCount' | 'suppliersCount' | 'bothCount'
}[] = [
  { value: 'ALL', labelKey: 'all', countKey: 'totalParties' },
  { value: 'CUSTOMER', labelKey: 'customers', countKey: 'customersCount' },
  { value: 'SUPPLIER', labelKey: 'suppliers', countKey: 'suppliersCount' },
  { value: 'BOTH', labelKey: 'both', countKey: 'bothCount' },
]

/** Status filter pills (All / Due / Active / Inactive) — mockup redesign.
 * Each maps to real query params; `tone` drives the pill color. */
export type PartyStatusFilter = 'ALL' | 'DUE' | 'ACTIVE' | 'INACTIVE'

export const PARTY_STATUS_OPTIONS: {
  value: PartyStatusFilter
  labelKey: 'all' | 'due' | 'active' | 'inactive'
  tone: 'brand' | 'due' | 'active' | 'inactive'
}[] = [
  { value: 'ALL', labelKey: 'all', tone: 'brand' },
  { value: 'DUE', labelKey: 'due', tone: 'due' },
  { value: 'ACTIVE', labelKey: 'active', tone: 'active' },
  { value: 'INACTIVE', labelKey: 'inactive', tone: 'inactive' },
]

/** Map a status pill to the party filter fields it drives. */
export const PARTY_STATUS_FILTERS: Record<
  PartyStatusFilter,
  { isActive?: boolean; hasOutstanding?: boolean }
> = {
  ALL: { isActive: undefined, hasOutstanding: undefined },
  DUE: { isActive: undefined, hasOutstanding: true },
  ACTIVE: { isActive: true, hasOutstanding: undefined },
  INACTIVE: { isActive: false, hasOutstanding: undefined },
}

export const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'recentTransaction', label: 'Recent' },
  { value: 'createdAt', label: 'Date Added' },
] as const

export const DEFAULT_FILTERS: PartyFilters = {
  page: 1,
  limit: 20,
  search: '',
  type: 'ALL',
  // undefined = All (active + inactive) — matches the default "All" status pill
  isActive: undefined,
  sortBy: 'name',
  sortOrder: 'asc',
}

export const PHONE_REGEX = /^[6-9]\d{9}$/
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
export const PINCODE_REGEX = /^\d{6}$/

/** GST state code → state name (2-digit code from GSTIN positions 0-1) */
export const GST_STATE_CODE_MAP: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '25': 'Dadra and Nagar Haveli', '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra', '28': 'Andhra Pradesh', '29': 'Karnataka',
  '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
}

/** GSTIN verification debounce delay in ms */
export const GSTIN_VERIFY_DEBOUNCE_MS = 500

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry',
  'Chandigarh', 'Dadra and Nagar Haveli', 'Lakshadweep',
  'Andaman and Nicobar Islands',
]
