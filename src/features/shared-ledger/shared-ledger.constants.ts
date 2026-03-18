/** Shared Ledger — Constants */

export const EXPIRY_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: null, label: 'Never expires' },
] as const

export const MAX_SHARES_PER_PARTY = 10
