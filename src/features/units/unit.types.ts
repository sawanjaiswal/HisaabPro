/** Units Feature — Type definitions
 *
 * Re-exports core unit types from products module.
 * UnitCategory is the canonical source in product-models.types.ts.
 */

export type { Unit, UnitConversion, CreateUnitData, CreateUnitConversionData, UnitCategory } from '../products/product.types'
export type { UnitType } from '../products/product.types'

/** Active tab on the Units page */
export type UnitsTab = 'units' | 'conversions'
