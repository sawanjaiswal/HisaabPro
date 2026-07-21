/**
 * Audit #5 — Google Drive backup (env-gated opt-in).
 *
 * When isDriveConfigured() is false, all /api/backup/drive/* routes 503.
 * getDriveRedirectUri is pinned server-side (never request-derived → no open
 * redirect). getDriveTokenEncKey is the AES-256-GCM key; the crypto layer
 * validates it decodes to exactly 32 bytes (base64 or hex) and fails closed.
 */

export function isDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
      process.env.GOOGLE_DRIVE_REDIRECT_URI &&
      process.env.GOOGLE_DRIVE_TOKEN_ENC_KEY,
  )
}

export const getDriveClientId = (): string | undefined => process.env.GOOGLE_DRIVE_CLIENT_ID
export const getDriveClientSecret = (): string | undefined => process.env.GOOGLE_DRIVE_CLIENT_SECRET
export const getDriveRedirectUri = (): string | undefined => process.env.GOOGLE_DRIVE_REDIRECT_URI
export const getDriveTokenEncKey = (): string | undefined => process.env.GOOGLE_DRIVE_TOKEN_ENC_KEY
