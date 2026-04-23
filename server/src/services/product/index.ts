/**
 * Product service — public API.
 * Re-exports all functions so callers import from 'product/index.js' (or via the shim).
 */

export { createProduct, getProduct, updateProduct, deleteProduct, findByBarcode } from './crud.js'
export { listProducts } from './search.js'
export { listStockMovements, listStockHistory, bulkAdjustStock } from './stock.js'
