/**
 * Notification provider webhook router
 * Mounted at /api/webhooks/notifications BEFORE the global JSON parser in app.ts
 *
 * Each child router mounts its own express.raw() body parser at the route level.
 * The global JSON parser is skipped for all paths under this prefix.
 */

import { Router } from 'express'
import msg91Router from './notifications-msg91.routes.js'
import resendRouter from './notifications-resend.routes.js'
import fcmRouter from './notifications-fcm.routes.js'
import aisensyRouter from './notifications-aisensy.routes.js'

const router = Router()

router.use('/msg91', msg91Router)
router.use('/resend', resendRouter)
router.use('/fcm', fcmRouter)
router.use('/aisensy', aisensyRouter)

export default router
