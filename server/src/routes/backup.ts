/**
 * Backup routes — adapted from HisaabPro
 * Manual backup, list, download, cooldown status.
 * Restore deferred until offline sync is built.
 */

import { Router } from 'express'
import type { Request } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { requireFeature } from '../middleware/subscription-gate.js'
import { createRateLimiter } from '../middleware/rate-limit/factory.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { isDriveConfigured } from '../lib/env.js'
import { driveCallbackQuerySchema } from '../schemas/backup.schemas.js'
import {
  createManualBackup,
  listBackups,
  getBackupData,
  getCooldownStatus,
} from '../services/backup.service.js'
import * as drive from '../services/backup/drive-backup.service.js'

const router = Router()

router.use(auth)
router.use(requireFeature('backup'))

// ── Audit #5 — Google Drive backup ────────────────────────────────────────

const DRIVE_UNAVAILABLE = 'Google Drive backup is not configured on this server'

/** Guard: short-circuit every Drive route with 503 when creds are absent. */
function requireDriveConfigured(res: Parameters<typeof sendError>[0]): boolean {
  if (isDriveConfigured()) return true
  sendError(res, DRIVE_UNAVAILABLE, 'SERVICE_UNAVAILABLE', 503)
  return false
}

/** Frontend base URL for the post-callback browser redirect (pinned, not request-derived). */
function frontendBase(): string {
  return (process.env.CORS_ORIGIN?.split(',')[0] ?? '').replace(/\/$/, '')
}

const driveBackupLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many Drive backups — max 10/hour',
  keyFn: (req: Request) => `drive-backup:${req.user?.userId ?? req.ip ?? 'unknown'}`,
  eventName: 'DRIVE_BACKUP_RATE_LIMIT_HIT',
})

/** GET /api/backup/drive/connect — return the Google consent URL */
router.get(
  '/drive/connect',
  asyncHandler(async (req, res) => {
    if (!requireDriveConfigured(res)) return
    const result = await drive.connect(req.user!.userId)
    sendSuccess(res, result)
  }),
)

/**
 * GET /api/backup/drive/callback — OAuth redirect target.
 * Requires auth (cookie session): the state must belong to the signed-in user.
 * Redirects the browser back to the SPA settings page on success/failure.
 */
router.get(
  '/drive/callback',
  asyncHandler(async (req, res) => {
    if (!isDriveConfigured()) {
      sendError(res, DRIVE_UNAVAILABLE, 'SERVICE_UNAVAILABLE', 503)
      return
    }
    const base = frontendBase()
    const parsed = driveCallbackQuerySchema.safeParse(req.query)
    if (!parsed.success || parsed.data.error || !parsed.data.code || !parsed.data.state) {
      res.redirect(`${base}/settings/backup?error=1`)
      return
    }
    try {
      await drive.complete(req.user!.userId, parsed.data.code, parsed.data.state)
      res.redirect(`${base}/settings/backup?connected=1`)
    } catch {
      res.redirect(`${base}/settings/backup?error=1`)
    }
  }),
)

/** GET /api/backup/drive/status — connection summary (never returns tokens) */
router.get(
  '/drive/status',
  asyncHandler(async (req, res) => {
    if (!isDriveConfigured()) {
      sendSuccess(res, { connected: false, configured: false })
      return
    }
    const result = await drive.status(req.user!.userId)
    sendSuccess(res, { ...result, configured: true })
  }),
)

/** POST /api/backup/drive/backup-now — upload a fresh backup to Drive */
router.post(
  '/drive/backup-now',
  requirePermission('settings.modify'),
  driveBackupLimiter,
  asyncHandler(async (req, res) => {
    if (!requireDriveConfigured(res)) return
    const result = await drive.backupNow(req.user!.userId)
    sendSuccess(res, result, 201)
  }),
)

/** POST /api/backup/drive/disconnect — revoke (best-effort) + delete row (idempotent) */
router.post(
  '/drive/disconnect',
  requirePermission('settings.modify'),
  asyncHandler(async (req, res) => {
    if (!requireDriveConfigured(res)) return
    await drive.disconnect(req.user!.userId)
    sendSuccess(res, { disconnected: true })
  }),
)

/** POST /api/backup/manual — create a manual backup */
router.post(
  '/manual',
  auth,
  requirePermission('settings.modify'),
  asyncHandler(async (req, res) => {
    const result = await createManualBackup(req.user!.userId)
    sendSuccess(res, result, 201)
  }),
)

/** GET /api/backup/list — list user's backups */
router.get(
  '/list',
  auth,
  asyncHandler(async (req, res) => {
    const backups = await listBackups(req.user!.userId)
    sendSuccess(res, backups)
  }),
)

/** GET /api/backup/download/:backupId — download backup data */
router.get(
  '/download/:backupId',
  auth,
  asyncHandler(async (req, res) => {
    const backupId = req.params.backupId as string
    const data = await getBackupData(req.user!.userId, backupId)
    sendSuccess(res, data)
  }),
)

/** GET /api/backup/cooldown-status — check if user can create a backup */
router.get(
  '/cooldown-status',
  auth,
  asyncHandler(async (req, res) => {
    const status = await getCooldownStatus(req.user!.userId)
    sendSuccess(res, status)
  }),
)

export default router
