/**
 * Audit #5 — Google Drive backup orchestration.
 *
 * connect    → issue user-bound PKCE state, return Google consent URL
 * complete   → consume state (assert userId), exchange code, encrypt + persist
 * status     → connection summary (never returns token material)
 * backupNow  → buildBackupData → refresh access token → upload → persist lastBackupAt
 * disconnect → best-effort revoke, ALWAYS delete the row (idempotent)
 *
 * Env-gated: callers guard with isDriveConfigured() and 503 when false.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { validationError } from '../../lib/errors.js'
import { buildBackupData } from '../backup.service.js'
import { encryptRefreshToken, decryptRefreshToken } from './drive-crypto.js'
import { saveOAuthState, consumeOAuthState } from './drive-oauth-state.js'
import {
  buildAuthUrl,
  exchangeCode,
  generatePkce,
  newState,
  getAccessToken,
  clearAccessTokenCache,
  revokeRefreshToken,
} from './oauth-drive.service.js'

/** Build a consent URL and stash a user-bound PKCE state (single-use, 10-min TTL). */
export async function connect(userId: string): Promise<{ authUrl: string }> {
  const state = newState()
  const { codeVerifier, codeChallenge } = generatePkce()
  await saveOAuthState(state, { userId, codeVerifier, expiresAt: Date.now() + 10 * 60 * 1000 })
  return { authUrl: buildAuthUrl(state, codeChallenge) }
}

/**
 * Handle the OAuth callback. The state MUST belong to the authenticated user
 * (account-attach defence). On success the refresh token is encrypted at rest.
 */
export async function complete(userId: string, code: string, state: string): Promise<void> {
  const record = await consumeOAuthState(state)
  if (!record) throw validationError('Invalid or expired authorization state')
  if (record.userId !== userId) {
    logger.warn('DRIVE_STATE_USER_MISMATCH', { expected: userId })
    throw validationError('Authorization state does not match the signed-in user')
  }

  const tokens = await exchangeCode(code, record.codeVerifier)
  const refreshTokenEnc = encryptRefreshToken(tokens.refreshToken)

  await prisma.driveBackupConnection.upsert({
    where: { userId },
    create: {
      userId,
      googleEmail: tokens.email,
      refreshTokenEnc,
      scope: tokens.scope,
    },
    update: {
      googleEmail: tokens.email,
      refreshTokenEnc,
      scope: tokens.scope,
      connectedAt: new Date(),
    },
  })
  clearAccessTokenCache(userId)
  logger.info('DRIVE_CONNECTED', { userId })
}

export interface DriveStatus {
  connected: boolean
  email?: string
  connectedAt?: Date
  lastBackupAt?: Date | null
}

export async function status(userId: string): Promise<DriveStatus> {
  const conn = await prisma.driveBackupConnection.findUnique({ where: { userId } })
  if (!conn) return { connected: false }
  return {
    connected: true,
    email: conn.googleEmail,
    connectedAt: conn.connectedAt,
    lastBackupAt: conn.lastBackupAt,
  }
}

export interface BackupNowResult {
  fileId: string
  sizeBytes: number
  uploadedAt: string
}

export async function backupNow(userId: string): Promise<BackupNowResult> {
  const conn = await prisma.driveBackupConnection.findUnique({ where: { userId } })
  if (!conn) throw validationError('Google Drive is not connected')

  const refreshToken = decryptRefreshToken(conn.refreshTokenEnc)
  const accessToken = await getAccessToken(userId, refreshToken)

  const payload = await buildBackupData(userId)
  const json = JSON.stringify(payload)

  // Lazy import keeps the upload SDK off the hot path for non-backup requests.
  const { uploadBackup } = await import('./drive-upload.service.js')
  const result = await uploadBackup(accessToken, json)

  await prisma.driveBackupConnection.update({
    where: { userId },
    data: { lastBackupAt: new Date() },
  })
  logger.info('DRIVE_BACKUP_UPLOADED', { userId, sizeBytes: result.sizeBytes })
  return result
}

/** Revoke at Google (best-effort) and always delete the local row. Idempotent. */
export async function disconnect(userId: string): Promise<void> {
  const conn = await prisma.driveBackupConnection.findUnique({ where: { userId } })
  if (conn) {
    try {
      const refreshToken = decryptRefreshToken(conn.refreshTokenEnc)
      await revokeRefreshToken(refreshToken)
    } catch {
      // decrypt/revoke best-effort — proceed to delete regardless
    }
  }
  clearAccessTokenCache(userId)
  await prisma.driveBackupConnection.deleteMany({ where: { userId } })
  logger.info('DRIVE_DISCONNECTED', { userId })
}
