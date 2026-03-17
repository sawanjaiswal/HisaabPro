/** Basic Inventory — Enum and type alias definitions
 *
 * All monetary amounts stored in PAISE (integer).
 * All quantities stored in the product's base unit.
 */

export type StockValidationMode = 'GLOBAL' | 'WARN_ONLY' | 'HARD_BLOCK'

export type StockMovementType =
  | 'SALE'
  | 'PURCHASE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'OPENING'
  | 'RETURN_IN'
  | 'RETURN_OUT'

export type StockAdjustReason =
  | 'DAMAGE'
  | 'THEFT'
  | 'AUDIT'
  | 'GIFT'
  | 'RETURN'
  | 'OTHER'

export type CategoryType = 'PREDEFINED' | 'CUSTOM'

export type UnitType = 'PREDEFINED' | 'CUSTOM'

export type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'DROPDOWN'

export type StockStatus = 'ok' | 'low' | 'out'

export type ProductSortBy =
  | 'name'
  | 'salePrice'
  | 'purchasePrice'
  | 'currentStock'
  | 'createdAt'

export type StockAdjustType = 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'

export type ReferenceType = 'INVOICE' | 'PURCHASE_ORDER' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'MANUAL'

export type StockValidationResult = 'OK' | 'WARN' | 'BLOCK'

export type LowStockAlertFrequency = 'ONCE' | 'DAILY' | 'EVERY_TIME'
