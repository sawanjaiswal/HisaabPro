/** Audit #5 — Google Drive backup feature types. */

export interface DriveBackupStatus {
  connected: boolean
  configured: boolean
  email?: string
  connectedAt?: string
  lastBackupAt?: string | null
}

export interface DriveConnectResponse {
  authUrl: string
}

export interface DriveBackupNowResult {
  fileId: string
  sizeBytes: number
  uploadedAt: string
}

/** Visual state the card renders, derived from status + in-flight flags. */
export type DriveCardState = 'loading' | 'error' | 'disconnected' | 'connecting' | 'connected'
