/**
 * Product services — barrel re-export
 *
 * Split into domain-specific files for maintainability:
 *   - product-crud.service.ts  — Product CRUD + Stock operations
 *   - category.service.ts      — Category CRUD
 *   - unit.service.ts          — Unit CRUD + Unit Conversions + Inventory Settings
 *
 * All existing imports from './product.service' continue to work unchanged.
 */

export {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  getStockMovements,
  validateStock,
} from './product-crud.service'

export type { StockValidateItem } from './product-crud.service'

export {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from './category.service'

export type { CategoryInput } from './category.service'

export {
  getUnits,
  createUnit,
  updateUnit,
  deleteUnit,
  getUnitConversions,
  createUnitConversion,
  deleteUnitConversion,
  getInventorySettings,
  updateInventorySettings,
} from './unit.service'

export type {
  UnitInput,
  UnitConversionInput,
  InventorySettingsInput,
} from './unit.service'
