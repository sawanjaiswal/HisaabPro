/** Units Feature — Constants */

import type { UnitCategory, UnitsTab } from './unit.types'

export const UNIT_CATEGORIES: readonly UnitCategory[] = [
  'WEIGHT',
  'VOLUME',
  'COUNT',
  'LENGTH',
  'AREA',
  'SERVICE',
  'PACKAGING',
  'OTHER',
] as const

export const UNIT_CATEGORY_LABELS: Record<UnitCategory, string> = {
  WEIGHT: 'Weight',
  VOLUME: 'Volume',
  COUNT: 'Count',
  LENGTH: 'Length',
  AREA: 'Area',
  SERVICE: 'Service',
  PACKAGING: 'Packaging',
  OTHER: 'Other',
}

/** Map predefined unit symbols to categories for display grouping */
export const PREDEFINED_UNIT_CATEGORIES: Record<string, UnitCategory> = {
  kg: 'WEIGHT',
  gm: 'WEIGHT',
  ltr: 'VOLUME',
  ml: 'VOLUME',
  pcs: 'COUNT',
  dz: 'COUNT',
  m: 'LENGTH',
  cm: 'LENGTH',
  ft: 'LENGTH',
  in: 'LENGTH',
  pr: 'COUNT',
  set: 'COUNT',
  bdl: 'PACKAGING',
  roll: 'PACKAGING',
  bag: 'PACKAGING',
  pkt: 'PACKAGING',
  btl: 'PACKAGING',
  can: 'PACKAGING',
  box: 'PACKAGING',
}

export const UNITS_PAGE_TABS: readonly { id: UnitsTab; label: string }[] = [
  { id: 'units', label: 'Units' },
  { id: 'conversions', label: 'Conversions' },
] as const

export const UNIT_NAME_MAX = 30
export const UNIT_SYMBOL_MAX = 10
