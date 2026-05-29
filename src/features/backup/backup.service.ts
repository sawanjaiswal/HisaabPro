/** Audit #5 — Google Drive backup API calls (all via api() — offline-aware). */

import { api } from '@/lib/api'
import type {
  DriveBackupStatus,
  DriveConnectResponse,
  DriveBackupNowResult,
} from './backup.types'

export async function fetchDriveStatus(): Promise<DriveBackupStatus> {
  // Not cached: connection state must always be fresh (no PII persisted).
  return api<DriveBackupStatus>('/backup/drive/status')
}

export async function fetchConnectUrl(): Promise<DriveConnectResponse> {
  return api<DriveConnectResponse>('/backup/drive/connect')
}

export async function backupNow(): Promise<DriveBackupNowResult> {
  return api<DriveBackupNowResult>('/backup/drive/backup-now', {
    method: 'POST',
    entityType: 'backup',
    entityLabel: 'Google Drive backup',
  })
}

export async function disconnectDrive(): Promise<{ disconnected: boolean }> {
  return api<{ disconnected: boolean }>('/backup/drive/disconnect', {
    method: 'POST',
    entityType: 'backup',
    entityLabel: 'Disconnect Google Drive',
  })
}
