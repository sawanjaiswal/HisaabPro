/**
 * Product Service — thin re-export shim.
 * Implementation lives in ./product/ sub-modules.
 * Kept for backward compat with existing import paths.
 */

export {
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
  findByBarcode,
  listProducts,
  listStockMovements,
  listStockHistory,
  bulkAdjustStock,
} from './product/index.js'
