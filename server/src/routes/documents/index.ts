/**
 * Documents router — mounts sub-routers by concern.
 * Mount point: /api/documents (set in app.ts — unchanged)
 *
 * Sub-routers:
 *   crud           — CRUD operations (list, get, create, update, delete, recycle-bin)
 *   quick-sale     — POST /validate-stock and POST /quick-sale (POS)
 *   convert-restore — POST /:id/convert, POST /:id/restore, DELETE /:id/permanent
 *   share          — POST /:id/share/whatsapp, POST /:id/share/email
 */

import { Router } from 'express'
import { auth } from '../../middleware/auth.js'
import { userMutationLimiter } from '../../middleware/rate-limit.js'
import { requireFeature } from '../../middleware/subscription-gate.js'

import crudRouter from './crud.js'
import quickSaleRouter from './quick-sale.js'
import convertRestoreRouter from './convert-restore.js'
import shareRouter from './share.js'

const router = Router()

// Shared middleware applied to every documents route
router.use(auth)
router.use(userMutationLimiter)
router.use(requireFeature('invoicing'))

// Static-path routes first to prevent /:id param shadowing
router.use('/', quickSaleRouter)   // /validate-stock, /quick-sale
router.use('/', crudRouter)        // /, /recycle-bin, /:id (CRUD)
router.use('/', convertRestoreRouter) // /:id/convert, /:id/restore, /:id/permanent
router.use('/', shareRouter)       // /:id/share/whatsapp, /:id/share/email

export default router
