/**
 * HR routes aggregator — Phase 6 PR5+PR6 (architecture §4 + §6.1).
 *
 * Mounted at /api/hr by app.routes.ts. Stacks the shared session middleware
 * (`auth + requireActiveBusiness`) once, then delegates to two sub-routers:
 *
 *   /api/hr/attendance/* — PR5 attendance (hr-attendance.routes.ts)
 *   /api/hr/employees/*  — PR6 employees   (hr-employees.routes.ts)
 *
 * Each sub-router owns its own per-route PIN + owner + idempotency middleware.
 * This file is intentionally tiny — adding new HR resources means adding a
 * new sub-router + one mount line, not touching the existing modules.
 *
 * Permission gate — Phase 6 has NO `hr.*` permission keys yet. Until those
 * land, sub-routers gate behind `requireOwner()`. When per-feature keys ship
 * the sub-routers grow `requirePermission('hr.read'/'hr.write')` lines.
 */

import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { requireActiveBusiness } from '../middleware/require-active-business.js'
import attendanceRouter from './hr-attendance.routes.js'
import employeesRouter from './hr-employees.routes.js'

const router = Router()

// All HR routes require an authenticated session with an active business.
router.use(auth, requireActiveBusiness)

router.use('/attendance', attendanceRouter)
router.use('/employees', employeesRouter)

export default router
