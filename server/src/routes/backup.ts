/**
 * Backup routes — adapted from HisaabPro
 * Manual backup, list, download, cooldown status.
 * Restore deferred until offline sync is built.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import {
  createManualBackup,
  listBackups,
  getBackupData,
  getCooldownStatus,
} from '../services/backup.service.js'

const router = Router()

/** POST /api/backup/manual — create a manual backup */
router.post(
  '/manual',
  auth,
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
    const backups = listBackups(req.user!.userId)
    sendSuccess(res, backups)
  }),
)

/** GET /api/backup/download/:backupId — download backup data */
router.get(
  '/download/:backupId',
  auth,
  asyncHandler(async (req, res) => {
    const backupId = req.params.backupId as string
    const data = getBackupData(req.user!.userId, backupId)
    sendSuccess(res, data)
  }),
)

/** GET /api/backup/cooldown-status — check if user can create a backup */
router.get(
  '/cooldown-status',
  auth,
  asyncHandler(async (req, res) => {
    const status = getCooldownStatus(req.user!.userId)
    sendSuccess(res, status)
  }),
)

export default router
