/**
 * Phase 7 — Import Engine · XLSX zip-bomb pre-scan
 *
 * Cross-references:
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md §S1, §S10 — pre-scan validates
 *     the central directory's declared uncompressed sizes + ratios; this
 *     catches the cheap bomb (small archive declaring TB of contents).
 *     The S10 follow-up is to ALSO guard the streaming extractor in the
 *     parser layer so a malicious zip lying about its sizes cannot bypass
 *     this pre-scan and OOM the box at decompression time.
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §4.3 — pre-scan runs BEFORE
 *     handing the buffer to xlsx / sheetjs.
 *
 * Pure-ish: takes a Buffer, returns a verdict. Uses yauzl.fromBuffer to
 * walk the central directory only — no entry contents are read.
 */

import yauzl from 'yauzl'
import {
  XLSX_MAX_UNCOMPRESSED,
  XLSX_MAX_RATIO,
} from '../../../constants/import.constants.js'

/** Error code surfaced to upload route on unsafe archive detection. */
export const UNSAFE_ARCHIVE = 'UNSAFE_ARCHIVE' as const

export interface ZipPrescanResult {
  safe: boolean
  reason?: typeof UNSAFE_ARCHIVE
  totalUncompressed?: number
}

// TODO(S10): the parser layer (API.3) MUST wrap sheetjs / streaming
// extraction with a counted-bytes guard. The central directory is
// authoritative for a well-formed archive, but a malicious zip can
// understate uncompressed sizes here and over-deliver at extract time.
// This pre-scan trusts the CD; the streaming guard is the second layer.
function isPathEscape(name: string): boolean {
  if (!name) return true
  if (name.startsWith('/') || name.startsWith('\\')) return true
  // Windows absolute path (C:\...) — yauzl preserves the raw name.
  if (/^[A-Za-z]:[\\/]/.test(name)) return true
  // Any path segment equal to ".." is a directory traversal attempt.
  const segments = name.split(/[\\/]/)
  return segments.some((s) => s === '..')
}

/**
 * Walks the XLSX zip central directory and returns a verdict before the
 * parser ever touches the archive. Rejects on:
 *   - total uncompressed size > XLSX_MAX_UNCOMPRESSED
 *   - any entry ratio > XLSX_MAX_RATIO (uncompressed / compressed)
 *   - any entry name with absolute path or `..` traversal
 *
 * Returns `{ safe: true, totalUncompressed }` on a clean archive so the
 * upload route can log the size for observability.
 */
export function prescanXlsxArchive(
  buffer: Buffer,
): Promise<ZipPrescanResult> {
  return new Promise((resolve) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true },
      (err, zip) => {
        if (err || !zip) {
          resolve({ safe: false, reason: UNSAFE_ARCHIVE })
          return
        }

        let totalUncompressed = 0
        let settled = false
        const settle = (result: ZipPrescanResult) => {
          if (settled) return
          settled = true
          try {
            zip.close()
          } catch {
            // closing after error is best-effort
          }
          resolve(result)
        }

        zip.on('entry', (entry: yauzl.Entry) => {
          if (isPathEscape(entry.fileName)) {
            settle({ safe: false, reason: UNSAFE_ARCHIVE })
            return
          }

          const u = Number(entry.uncompressedSize) || 0
          const c = Number(entry.compressedSize) || 0
          totalUncompressed += u

          if (totalUncompressed > XLSX_MAX_UNCOMPRESSED) {
            settle({ safe: false, reason: UNSAFE_ARCHIVE })
            return
          }

          if (c > 0 && u / c > XLSX_MAX_RATIO) {
            settle({ safe: false, reason: UNSAFE_ARCHIVE })
            return
          }

          zip.readEntry()
        })

        zip.on('end', () => {
          settle({ safe: true, totalUncompressed })
        })

        zip.on('error', () => {
          settle({ safe: false, reason: UNSAFE_ARCHIVE })
        })

        zip.readEntry()
      },
    )
  })
}
