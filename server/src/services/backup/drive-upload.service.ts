/**
 * Audit #5 — Upload a backup JSON blob to the user's Google Drive.
 *
 * Uses an OAuth2 client primed with a fresh access token. Files are created
 * under the app's own scope (drive.file). Provider errors are scrubbed so no
 * token material can leak into logs.
 */

import { Readable } from 'stream'
import { google } from 'googleapis'

const BACKUP_FILE_NAME = 'hisaabpro-backup.json'
const MIME = 'application/json'

export interface DriveUploadResult {
  fileId: string
  sizeBytes: number
  uploadedAt: string
}

function driveClient(accessToken: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return google.drive({ version: 'v3', auth })
}

/**
 * Create (or overwrite, when an existing fileId is supplied) the backup file.
 * Returns the Drive file id and uploaded size.
 */
export async function uploadBackup(
  accessToken: string,
  json: string,
  existingFileId?: string,
): Promise<DriveUploadResult> {
  const drive = driveClient(accessToken)
  const sizeBytes = Buffer.byteLength(json, 'utf8')
  const media = { mimeType: MIME, body: Readable.from([json]) }

  try {
    if (existingFileId) {
      const { data } = await drive.files.update({
        fileId: existingFileId,
        media,
        fields: 'id',
      })
      return { fileId: data.id ?? existingFileId, sizeBytes, uploadedAt: new Date().toISOString() }
    }

    const { data } = await drive.files.create({
      requestBody: { name: BACKUP_FILE_NAME, mimeType: MIME },
      media,
      fields: 'id',
    })
    if (!data.id) throw new Error('DRIVE_UPLOAD_NO_FILE_ID')
    return { fileId: data.id, sizeBytes, uploadedAt: new Date().toISOString() }
  } catch (err) {
    throw new Error(`DRIVE_UPLOAD_FAILED: ${scrub(err)}`)
  }
}

function scrub(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/[A-Za-z0-9._-]{20,}/g, '[redacted]').slice(0, 200)
}
