/**
 * Shared default values — SSOT for business seeding + category services
 */

/** Default fallback color for categories */
export const DEFAULT_CATEGORY_COLOR = '#6B7280'

/** 10 predefined product categories per PRD — seeded for every new business */
export const DEFAULT_CATEGORIES = [
  { name: 'General',         color: '#6B7280', sortOrder: 0 },
  { name: 'Electronics',     color: '#3B82F6', sortOrder: 1 },
  { name: 'Grocery',         color: '#22C55E', sortOrder: 2 },
  { name: 'Clothing',        color: '#A855F7', sortOrder: 3 },
  { name: 'Hardware',        color: '#F97316', sortOrder: 4 },
  { name: 'Stationery',      color: '#EAB308', sortOrder: 5 },
  { name: 'Food & Beverage', color: '#EF4444', sortOrder: 6 },
  { name: 'Health & Beauty',  color: '#EC4899', sortOrder: 7 },
  { name: 'Auto Parts',      color: '#6366F1', sortOrder: 8 },
  { name: 'Other',           color: '#94A3B8', sortOrder: 9 },
] as const
