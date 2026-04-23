/**
 * Product Routes — barrel.
 *
 * Composes CRUD, stock, bulk (import/export/reorder/barcode/label-data),
 * and image sub-routers into the single router mounted at /api/products.
 *
 * ROUTE ORDER: static & prefixed paths MUST come before bare /:id to avoid
 * param capture. bulk + stock sub-routers register all their static paths
 * (`/stock/validate`, `/bulk-import`, `/export`, `/by-barcode/:code`, ...)
 * and stock/:id/... paths before crud.ts mounts `/:id`.
 */

import { Router } from 'express'
import { auth } from '../../middleware/auth.js'
import { userMutationLimiter } from '../../middleware/rate-limit.js'
import { requireFeature } from '../../middleware/subscription-gate.js'
import bulkRouter from './bulk.js'
import stockRouter from './stock.js'
import imagesRouter from './images.js'
import crudRouter from './crud.js'

const router = Router()

router.use(auth)
router.use(userMutationLimiter)
router.use(requireFeature('products'))

// Static & prefixed paths first — avoid /:id param capture.
router.use('/', bulkRouter)
router.use('/', stockRouter)
router.use('/', imagesRouter)
// CRUD last because it includes bare /:id.
router.use('/', crudRouter)

export default router
