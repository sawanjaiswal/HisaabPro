/**
 * POS Router — mounts all POS sub-routes under /api/pos
 *
 * Sales:           pos-sales.ts      → /api/pos/sales
 * Products+Share:  pos-products-receipt.ts → /api/pos/products, /api/pos/receipt/:id/share
 */

import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { requireFeature } from '../middleware/subscription-gate.js'
import salesRoutes from './pos-sales.js'
import productsReceiptRoutes from './pos-products-receipt.js'

const router = Router()

// POS is a paid feature. `<PlanGate feature="posMode">` in src/App.tsx only
// decides which screens render — an entitlement enforced solely in the client
// is decoration, so the plan is checked here, where the documents are created.
// `auth` runs first because the gate reads req.user.businessId and no-ops
// without it; the sub-routes re-run it, which is idempotent.
router.use(auth, requireFeature('posMode'))

// Sales CRUD + void/restore
router.use('/sales', salesRoutes)

// Product grid + receipt share
router.use('/', productsReceiptRoutes)

export default router
