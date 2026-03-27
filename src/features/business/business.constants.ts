/** Deterministic avatar colors — professional palette for business initials */
export const AVATAR_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F97316',
  '#22C55E', '#06B6D4', '#EAB308', '#EF4444',
] as const

export const BUSINESS_TYPE_OPTIONS = [
  { value: 'general',       label: 'General / Retail' },
  { value: 'wholesale',     label: 'Wholesale / Distribution' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'services',      label: 'Services' },
] as const

export const BUSINESS_NAME_MIN = 2
export const BUSINESS_NAME_MAX = 50
