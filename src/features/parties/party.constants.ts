/** Party Management — Constants */

import type { PartyType, PartyFilters } from './party.types'

export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  CUSTOMER: 'Customer',
  SUPPLIER: 'Supplier',
  BOTH: 'Both',
}

export const PARTY_TYPE_OPTIONS: { value: PartyType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'SUPPLIER', label: 'Suppliers' },
  { value: 'BOTH', label: 'Both' },
]

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
  isActive: true,
  sortBy: 'name',
  sortOrder: 'asc',
}

export const PHONE_REGEX = /^[6-9]\d{9}$/
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
export const PINCODE_REGEX = /^\d{6}$/

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
