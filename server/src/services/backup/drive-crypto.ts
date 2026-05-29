/**
 * Audit #5 — AES-256-GCM encryption for the Google Drive refresh token at rest.
 *
 * Storage format: `ivB64:authTagB64:ciphertextB64` (3 base64 parts, colon-joined).
 * A fresh 12-byte random IV is generated per encryption (never reused). The
 * GCM auth tag is verified on decrypt — a tampered ciphertext throws.
 *
 * Fail-closed: if GOOGLE_DRIVE_TOKEN_ENC_KEY is missing or does not decode to
 * exactly 32 bytes, both encrypt and decrypt throw. The plaintext refresh
 * token is NEVER logged or returned to clients.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { getDriveTokenEncKey } from '../../lib/env.js'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12
const KEY_BYTES = 32

/**
 * Decode the configured key from base64 or hex into a 32-byte Buffer.
 * Throws (fail-closed) when the key is absent or the wrong length.
 */
function loadKey(): Buffer {
  const raw = getDriveTokenEncKey()
  if (!raw) {
    throw new Error('DRIVE_ENC_KEY_MISSING: GOOGLE_DRIVE_TOKEN_ENC_KEY not set')
  }
  // Try base64 first, then hex; accept whichever yields exactly 32 bytes.
  const b64 = Buffer.from(raw, 'base64')
  if (b64.length === KEY_BYTES) return b64
  const hex = Buffer.from(raw, 'hex')
  if (hex.length === KEY_BYTES) return hex
  throw new Error('DRIVE_ENC_KEY_INVALID: key must decode to exactly 32 bytes (base64 or hex)')
}

export function encryptRefreshToken(plaintext: string): string {
  const key = loadKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':')
}

export function decryptRefreshToken(stored: string): string {
  const key = loadKey()
  const parts = stored.split(':')
  if (parts.length !== 3) {
    throw new Error('DRIVE_ENC_FORMAT_INVALID: expected ivB64:authTagB64:ciphertextB64')
  }
  const [ivB64, authTagB64, ciphertextB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const ciphertext = Buffer.from(ciphertextB64, 'base64')
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
