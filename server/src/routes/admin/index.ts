/**
 * Admin Routes — barrel router
 * All routes are prefixed with /api/admin in index.ts
 *
 * Route map:
 *   POST   /api/admin/auth/login          — admin login
 *   POST   /api/admin/auth/refresh        — refresh token
 *   POST   /api/admin/auth/logout         — logout
 *   GET    /api/admin/auth/me             — current admin profile
 *
 *   GET    /api/admin/users               — list users (paginated)
 *   GET    /api/admin/users/:id           — user detail
 *   POST   /api/admin/users/:id/suspend   — suspend user (SUPER_ADMIN)
 *   POST   /api/admin/users/:id/unsuspend — unsuspend user (SUPER_ADMIN)
 *   POST   /api/admin/users/:id/unlock    — clear lockout (SUPER_ADMIN)
 *
 *   GET    /api/admin/businesses          — list businesses (paginated)
 *   GET    /api/admin/businesses/:id      — business detail
 *
 *   GET    /api/admin/dashboard/overview  — platform stats
 *   GET    /api/admin/dashboard/growth    — growth metrics
 *
 *   GET    /api/admin/settings            — all settings
 *   PUT    /api/admin/settings/:key       — update setting (SUPER_ADMIN)
 */

import { Router } from 'express'
import adminAuthRoutes from './admin-auth.js'
import adminUsersRoutes from './admin-users.js'
import adminBusinessesRoutes from './admin-businesses.js'
import adminDashboardRoutes from './admin-dashboard.js'
import adminSettingsRoutes from './admin-settings.js'

const router = Router()

router.use('/auth', adminAuthRoutes)
router.use('/users', adminUsersRoutes)
router.use('/businesses', adminBusinessesRoutes)
router.use('/dashboard', adminDashboardRoutes)
router.use('/settings', adminSettingsRoutes)

export default router
