/** Units Feature — Pure utility functions */

import type { Unit, UnitCategory } from './unit.types'
import { PREDEFINED_UNIT_CATEGORIES, UNIT_NAME_MAX, UNIT_SYMBOL_MAX } from './unit.constants'

/** Get category — uses API field if available, falls back to symbol inference */
export function getUnitCategory(unit: Unit): UnitCategory {
  if (unit.category) return unit.category
  if (unit.type === 'PREDEFINED') {
    return PREDEFINED_UNIT_CATEGORIES[unit.symbol] ?? 'OTHER'
  }
  return 'OTHER'
}

/** Group units by category, preserving order */
export function groupUnitsByCategory(units: Unit[]): Map<UnitCategory, Unit[]> {
  const groups = new Map<UnitCategory, Unit[]>()
  for (const unit of units) {
    const cat = getUnitCategory(unit)
    const list = groups.get(cat) ?? []
    list.push(unit)
    groups.set(cat, list)
  }
  return groups
}

/** Display string: "kilogram (kg)" */
export function formatUnitDisplay(unit: Unit): string {
  return `${unit.name} (${unit.symbol})`
}

/** Validate unit name — returns error message or null */
export function validateUnitName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'Name is required'
  if (trimmed.length > UNIT_NAME_MAX) return `Name must be ${UNIT_NAME_MAX} characters or fewer`
  return null
}

/** Validate unit symbol — returns error message or null */
export function validateUnitSymbol(symbol: string): string | null {
  const trimmed = symbol.trim()
  if (trimmed.length === 0) return 'Symbol is required'
  if (trimmed.length > UNIT_SYMBOL_MAX) return `Symbol must be ${UNIT_SYMBOL_MAX} characters or fewer`
  if (!/^[a-zA-Z0-9]+$/.test(trimmed)) return 'Symbol must be letters and numbers only'
  return null
}
