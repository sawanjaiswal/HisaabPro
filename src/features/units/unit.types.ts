/** Units Feature — Type definitions
 *
 * Re-exports core unit types from products module and adds
 * unit-category enum + enhanced interfaces for the Units page.
 */

export type { Unit, UnitConversion, CreateUnitData, CreateUnitConversionData } from '../products/product.types'
export type { UnitType } from '../products/product.types'

/** Unit category for grouping in the management UI */
export type UnitCategory =
  | 'WEIGHT'
  | 'VOLUME'
  | 'COUNT'
  | 'LENGTH'
  | 'AREA'
  | 'SERVICE'
  | 'PACKAGING'
  | 'OTHER'

/** Active tab on the Units page */
export type UnitsTab = 'units' | 'conversions'
