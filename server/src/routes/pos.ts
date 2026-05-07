/**
 * POS Router — mounts all POS sub-routes under /api/pos
 *
 * Sales:           pos-sales.ts      → /api/pos/sales
 * Products+Share:  pos-products-receipt.ts → /api/pos/products, /api/pos/receipt/:id/share
 */

import { Router } from 'express'
import salesRoutes from './pos-sales.js'
import productsReceiptRoutes from './pos-products-receipt.js'

const router = Router()

// Sales CRUD + void/restore
router.use('/sales', salesRoutes)

// Product grid + receipt share
router.use('/', productsReceiptRoutes)

export default router
