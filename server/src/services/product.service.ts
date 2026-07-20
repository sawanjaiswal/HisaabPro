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
  listStockAdjustments,
  bulkAdjustStock,
  getProductAnalytics,
} from './product/index.js'
