/**
 * Phase 7 Slice 7.1A — Pure client-side validators for the upload step.
 * No JSX, no React, no api(). Returns translation-key codes so the UI
 * can format the message.
 */

import {
  FORMAT_OPTIONS,
  MAX_FILE_BYTES,
  type FormatOption,
} from '../constants/import.constants'
import type { ImportFormat } from '../types/import.types'

export type FileValidationCode =
  | 'OK'
  | 'NO_FILE'
  | 'NO_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'EXTENSION_MISMATCH'

export interface FileValidationResult {
  ok: boolean
  code: FileValidationCode
}

/** Lowercase last extension (everything after the last dot). */
export function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.')
  if (idx < 0 || idx === fileName.length - 1) return ''
  return fileName.slice(idx + 1).toLowerCase()
}

/** Human-readable byte size — KB / MB / GB with one decimal. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function findFormatOption(format: ImportFormat | null): FormatOption | null {
  if (!format) return null
  return FORMAT_OPTIONS.find((o) => o.value === format) ?? null
}

export function validateUpload(
  file: File | null,
  format: ImportFormat | null,
): FileValidationResult {
  if (!format) return { ok: false, code: 'NO_FORMAT' }
  if (!file) return { ok: false, code: 'NO_FILE' }
  if (file.size > MAX_FILE_BYTES) return { ok: false, code: 'FILE_TOO_LARGE' }
  const opt = findFormatOption(format)
  if (!opt) return { ok: false, code: 'NO_FORMAT' }
  const ext = getExtension(file.name)
  if (!opt.extensions.includes(ext)) return { ok: false, code: 'EXTENSION_MISMATCH' }
  return { ok: true, code: 'OK' }
}
