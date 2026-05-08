/**
 * Marketing Router — assembles sub-routers (PR2-PR5)
 * Mounted at /api/marketing in app.routes.ts
 * All routes behind requireAuth (applied per sub-router).
 */

import { Router } from 'express'
import { sendError } from '../lib/response.js'
import { isMarketingEnabled } from '../lib/env.js'
import templatesRouter from './marketing/templates.js'
import campaignsRouter from './marketing/campaigns.js'
import segmentsRouter from './marketing/segments.js'
import reminderRulesRouter from './marketing/reminder-rules.js'

const router = Router()

// Feature flag guard
router.use((_req, res, next) => {
  if (!isMarketingEnabled()) {
    return sendError(res, 'Marketing feature is disabled', 'SERVICE_UNAVAILABLE', 503)
  }
  next()
})

router.use('/templates', templatesRouter)
router.use('/campaigns', campaignsRouter)
router.use('/reminder-rules', reminderRulesRouter)
router.use('/', segmentsRouter) // handles /segments/preview and /opt-out/:partyId

export default router
